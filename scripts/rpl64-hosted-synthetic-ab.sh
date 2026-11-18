#!/usr/bin/env bash
set -euo pipefail

carelog_fe_source="${1:?Pinned Carelog FE checkout is required}"
carelog_be_source="${2:?Pinned Carelog BE checkout is required}"
platform_source="${3:?Pinned Platform checkout is required}"
: "${RUNNER_TEMP:?A disposable hosted runner is required}"
: "${GITHUB_STEP_SUMMARY:?GitHub step summary is required}"
: "${JAVA_HOME_17_X64:?Java 17 is required}"
: "${JAVA_HOME_21_X64:?Java 21 is required}"

expected_fe_sha=c4d67d4986fb0fabcf2014e73753b19f4ce0334d
expected_fe_tree=ed145d2d2b43ec3a4ee5e2f21efb513e336e1af2
expected_be_sha=a03e19a4a15c52e2de79bf08934b060cd71d7b3a
expected_be_tree=39bb59a423e264bb345924a8ad825e5af30c9551
expected_platform_sha=5a0b0dc38f1d53655cc21613f9b202a317d7c37d
expected_platform_tree=9057914850b9e0026fa8851cbb062c692a51b4b3

if [[ "${GITHUB_REPOSITORY:-}" != "ranikun-labs/carelog-fe" ||
      "${GITHUB_REF:-}" != "refs/heads/codex/rpl64-synthetic-ab-hosted-20261118" ]]; then
  printf 'Carelog synthetic A/B runner rejected an unexpected repository or ref.\n' >&2
  exit 1
fi

log_dir="$(mktemp -d "$RUNNER_TEMP/carelog-rpl64-synthetic-ab.XXXXXX")"
chmod 700 "$log_dir"
phase=source-binding
core_pid=
be_pid=
gateway_pid=
frontend_pid=

fail() {
  printf 'Carelog synthetic A/B stopped at phase=%s; runner diagnostics were not published.\n' "$phase" >&2
  exit 1
}

stop_group() {
  local pid="$1"
  [[ -n "$pid" ]] || return 0
  if kill -0 "$pid" 2>/dev/null; then
    kill -TERM -- "-$pid" 2>/dev/null || kill -TERM "$pid" 2>/dev/null || true
    for _ in $(seq 1 20); do
      kill -0 "$pid" 2>/dev/null || return 0
      sleep 0.25
    done
    kill -KILL -- "-$pid" 2>/dev/null || kill -KILL "$pid" 2>/dev/null || true
  fi
  wait "$pid" 2>/dev/null || true
}

cleanup() {
  local status=$?
  trap - EXIT INT TERM
  stop_group "$frontend_pid"
  stop_group "$gateway_pid"
  stop_group "$be_pid"
  stop_group "$core_pid"
  rm -rf "$log_dir"
  exit "$status"
}
trap cleanup EXIT INT TERM

check_source() {
  local path="$1" expected_sha="$2" expected_tree="$3"
  [[ "$(git -C "$path" rev-parse HEAD)" == "$expected_sha" &&
     "$(git -C "$path" rev-parse 'HEAD^{tree}')" == "$expected_tree" ]]
}
check_source "$carelog_fe_source" "$expected_fe_sha" "$expected_fe_tree" || fail
check_source "$carelog_be_source" "$expected_be_sha" "$expected_be_tree" || fail
check_source "$platform_source" "$expected_platform_sha" "$expected_platform_tree" || fail

phase=ephemeral-fixture
fixture="$(node --input-type=module <<'NODE'
import { randomBytes, randomUUID } from 'node:crypto';
const suffix = randomBytes(8).toString('hex');
console.log([
  randomUUID(), randomUUID(), randomUUID(), randomUUID(),
  randomUUID(), randomUUID(),
  `rpl64-a-${suffix}`, `rpl64-b-${suffix}`,
  randomBytes(32).toString('base64url'), randomBytes(32).toString('base64url'),
  randomBytes(32).toString('hex'), randomBytes(32).toString('hex'),
  randomBytes(32).toString('hex'), randomBytes(32).toString('hex'),
  randomBytes(32).toString('hex'),
].join('\t'));
NODE
)" || fail
IFS=$'\t' read -r account_a account_b org_a org_b customer_id event_id login_a login_b password_a password_b core_db_password be_db_password jwt_secret gateway_secret projection_secret <<< "$fixture"
unset fixture

for value in "$account_a" "$account_b" "$org_a" "$org_b" "$customer_id" "$event_id" \
  "$login_a" "$login_b" "$password_a" "$password_b" "$core_db_password" "$be_db_password" \
  "$jwt_secret" "$gateway_secret" "$projection_secret"; do
  printf '::add-mask::%s\n' "$value"
done

PGHOST=127.0.0.1 PGPORT=5432 PGUSER=postgres PGDATABASE=postgres
export PGHOST PGPORT PGUSER PGDATABASE
for _ in $(seq 1 60); do
  if pg_isready -q; then break; fi
  sleep 1
done
pg_isready -q || fail

if ! psql -X -v ON_ERROR_STOP=1 >"$log_dir/schema.log" 2>&1 <<SQL
CREATE ROLE carelog_core_e2e LOGIN PASSWORD '$core_db_password' NOSUPERUSER NOCREATEDB NOCREATEROLE;
CREATE ROLE carelog_be_e2e LOGIN PASSWORD '$be_db_password' NOSUPERUSER NOCREATEDB NOCREATEROLE;
CREATE DATABASE carelog_core_e2e OWNER carelog_core_e2e;
CREATE DATABASE carelog_be_e2e OWNER carelog_be_e2e;
REVOKE CONNECT ON DATABASE carelog_core_e2e FROM PUBLIC;
REVOKE CONNECT ON DATABASE carelog_be_e2e FROM PUBLIC;
GRANT CONNECT ON DATABASE carelog_core_e2e TO carelog_core_e2e;
GRANT CONNECT ON DATABASE carelog_be_e2e TO carelog_be_e2e;
SQL
then
  phase=ephemeral-schema
  fail
fi

if ! psql -X -v ON_ERROR_STOP=1 -d carelog_core_e2e >"$log_dir/core-schema.log" 2>&1 <<'SQL'
REVOKE ALL ON SCHEMA public FROM PUBLIC;
CREATE SCHEMA identity AUTHORIZATION carelog_core_e2e;
SQL
then
  phase=core-schema
  fail
fi
if ! psql -X -v ON_ERROR_STOP=1 -d carelog_be_e2e >"$log_dir/be-schema.log" 2>&1 <<'SQL'
REVOKE ALL ON SCHEMA public FROM PUBLIC;
ALTER SCHEMA public OWNER TO carelog_be_e2e;
SQL
then
  phase=be-schema
  fail
fi

phase=build
if ! (cd "$platform_source" && JAVA_HOME="$JAVA_HOME_21_X64" PATH="$JAVA_HOME_21_X64/bin:$PATH" ./gradlew --no-daemon --console=plain bootJar) >"$log_dir/platform-build.log" 2>&1; then
  fail
fi
if ! (cd "$carelog_be_source" && JAVA_HOME="$JAVA_HOME_17_X64" PATH="$JAVA_HOME_17_X64/bin:$PATH" ./gradlew --no-daemon --console=plain :carelog-be:bootJar) >"$log_dir/be-build.log" 2>&1; then
  fail
fi

find_boot_jar() {
  local dir="$1" result
  result="$(find "$dir" -maxdepth 1 -type f -name '*.jar' ! -name '*-plain.jar' -print -quit)"
  [[ -n "$result" && -f "$result" ]] || return 1
  printf '%s' "$result"
}
core_jar="$(find_boot_jar "$platform_source/platform-core/app/build/libs")" || { phase=core-jar; fail; }
gateway_jar="$(find_boot_jar "$platform_source/gateway-app/build/libs")" || { phase=gateway-jar; fail; }
be_jar="$(find_boot_jar "$carelog_be_source/carelog-be/build/libs")" || { phase=be-jar; fail; }

phase=password-hash-fixture
crypto_entry="$("$JAVA_HOME_17_X64/bin/jar" tf "$be_jar" | awk '/^BOOT-INF\/lib\/spring-security-crypto-[^/]+\.jar$/ { print; exit }')"
[[ -n "$crypto_entry" ]] || fail
spring_jcl_entry="$("$JAVA_HOME_17_X64/bin/jar" tf "$be_jar" | awk '/^BOOT-INF\/lib\/spring-jcl-[^/]+\.jar$/ { print; exit }')"
[[ -n "$spring_jcl_entry" ]] || fail
mkdir -p "$log_dir/crypto" "$log_dir/classes"
if ! (cd "$log_dir/crypto" && "$JAVA_HOME_17_X64/bin/jar" xf "$be_jar" "$crypto_entry" "$spring_jcl_entry") >"$log_dir/crypto-extract.log" 2>&1; then
  fail
fi
crypto_jar="$log_dir/crypto/$crypto_entry"
spring_jcl_jar="$log_dir/crypto/$spring_jcl_entry"
cat >"$log_dir/SyntheticPasswordHash.java" <<'JAVA'
import java.io.BufferedReader;
import java.io.InputStreamReader;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;

public final class SyntheticPasswordHash {
    public static void main(String[] args) throws Exception {
        BCryptPasswordEncoder encoder = new BCryptPasswordEncoder();
        try (BufferedReader reader = new BufferedReader(new InputStreamReader(System.in))) {
            String line;
            while ((line = reader.readLine()) != null) {
                System.out.println(encoder.encode(line));
            }
        }
    }
}
JAVA
if ! "$JAVA_HOME_17_X64/bin/javac" -cp "$crypto_jar:$spring_jcl_jar" -d "$log_dir/classes" "$log_dir/SyntheticPasswordHash.java" >"$log_dir/hash-compile.log" 2>&1; then
  fail
fi
password_hashes="$(printf '%s\n%s\n' "$password_a" "$password_b" | "$JAVA_HOME_17_X64/bin/java" -cp "$log_dir/classes:$crypto_jar:$spring_jcl_jar" SyntheticPasswordHash 2>"$log_dir/hash-runtime.log")" || fail
IFS=$'\n' read -r password_hash_a password_hash_b <<< "$password_hashes"
unset password_hashes
[[ -n "$password_hash_a" && -n "$password_hash_b" ]] || fail
printf '::add-mask::%s\n::add-mask::%s\n' "$password_hash_a" "$password_hash_b"

phase=service-build
core_port=18081
core_management_port=19092
be_port=18082
be_management_port=19093
gateway_port=18080
gateway_management_port=19091
frontend_port=4173
redis_port=6379
setsid env \
  SPRING_PROFILES_ACTIVE=fixture \
  PLATFORM_ENVIRONMENT=test \
  PLATFORM_CORE_PORT="$core_port" \
  PLATFORM_CORE_MANAGEMENT_PORT="$core_management_port" \
  SERVER_PORT="$core_port" \
  SERVER_ADDRESS=127.0.0.1 MANAGEMENT_SERVER_ADDRESS=127.0.0.1 \
  MANAGEMENT_SERVER_PORT="$core_management_port" \
  MANAGEMENT_ENDPOINT_HEALTH_PROBES_ENABLED=true \
  PLATFORM_IDENTITY_AUTH_ENABLED=true \
  PLATFORM_IDENTITY_DATASOURCE_URL="jdbc:postgresql://127.0.0.1:5432/carelog_core_e2e?currentSchema=identity&connectTimeout=3&socketTimeout=10" \
  PLATFORM_IDENTITY_DATASOURCE_USERNAME=carelog_core_e2e \
  PLATFORM_IDENTITY_DATASOURCE_PASSWORD="$core_db_password" \
  PLATFORM_IDENTITY_FLYWAY_DATASOURCE_URL="jdbc:postgresql://127.0.0.1:5432/carelog_core_e2e?currentSchema=identity&connectTimeout=3&socketTimeout=10" \
  PLATFORM_IDENTITY_FLYWAY_DATASOURCE_USERNAME=carelog_core_e2e \
  PLATFORM_IDENTITY_FLYWAY_DATASOURCE_PASSWORD="$core_db_password" \
  PLATFORM_IDENTITY_REDIS_HOST=127.0.0.1 PLATFORM_IDENTITY_REDIS_PORT="$redis_port" \
  PLATFORM_IDENTITY_REDIS_KEY_PREFIX="rpl64-e2e:identity:${GITHUB_RUN_ID:-local}:" \
  PLATFORM_IDENTITY_JWT_SECRET_KEY="$jwt_secret" \
  PLATFORM_IDENTITY_JWT_ACCESS_TOKEN_VALIDITY=3600000 \
  PLATFORM_IDENTITY_JWT_REFRESH_TOKEN_VALIDITY=86400000 \
  PLATFORM_IDENTITY_PRODUCT_CLAIMS_ENABLED=true \
  PLATFORM_IDENTITY_PRODUCT_CLAIMS_BASE_URL="http://127.0.0.1:$be_port" \
  PLATFORM_IDENTITY_PRODUCT_CLAIMS_SERVICE_SECRET="$projection_secret" \
  PLATFORM_IDENTITY_PRODUCT_CLAIMS_READ_TIMEOUT=2s \
  PLATFORM_IDENTITY_KAKAO_CLIENT_ID=synthetic-unused \
  PLATFORM_IDENTITY_KAKAO_CLIENT_SECRET=synthetic-unused \
  PLATFORM_IDENTITY_KAKAO_AUTHORIZATION_URI=http://127.0.0.1:9/unused \
  PLATFORM_IDENTITY_KAKAO_TOKEN_URI=http://127.0.0.1:9/unused \
  PLATFORM_IDENTITY_KAKAO_USER_INFO_URI=http://127.0.0.1:9/unused \
  PLATFORM_IDENTITY_OAUTH_KAKAO_WEB_REDIRECT_URI=http://127.0.0.1:9/callback \
  PLATFORM_IDENTITY_OAUTH_KAKAO_MOBILE_REDIRECT_URI=http://127.0.0.1:9/mobile \
  PLATFORM_IDENTITY_OAUTH_ALLOWED_RETURN_ORIGINS=http://127.0.0.1:9 \
  SHARED_AI_FOUNDATION_ENABLED=false SHARED_AI_SPRING_AI_ENABLED=false SHARED_AUDIT_ENABLED=false \
  "$JAVA_HOME_21_X64/bin/java" -Xms64m -Xmx512m -jar "$core_jar" >"$log_dir/core.log" 2>&1 &
core_pid=$!

setsid env \
  SPRING_PROFILES_ACTIVE=fixture \
  SERVER_ADDRESS=127.0.0.1 MANAGEMENT_SERVER_ADDRESS=127.0.0.1 \
  SERVER_PORT="$be_port" MANAGEMENT_SERVER_PORT="$be_management_port" \
  SPRING_DATASOURCE_URL="jdbc:postgresql://127.0.0.1:5432/carelog_be_e2e?currentSchema=public&connectTimeout=3&socketTimeout=10" \
  SPRING_DATASOURCE_USERNAME=carelog_be_e2e SPRING_DATASOURCE_PASSWORD="$be_db_password" \
  REDIS_HOST=127.0.0.1 REDIS_PORT="$redis_port" \
  JWT_SECRET_KEY="$jwt_secret" JWT_ACCESS_TOKEN_VALIDITY=3600000 JWT_REFRESH_TOKEN_VALIDITY=86400000 \
  GATEWAY_INTERNAL_SECRET="$gateway_secret" \
  CARELOG_INTERNAL_IDENTITY_CLAIMS_ENABLED=true \
  CARELOG_INTERNAL_IDENTITY_CLAIMS_SERVICE_SECRET="$projection_secret" \
  "$JAVA_HOME_17_X64/bin/java" -Xms64m -Xmx512m -jar "$be_jar" >"$log_dir/carelog-be.log" 2>&1 &
be_pid=$!

wait_health() {
  local url="$1"
  for _ in $(seq 1 120); do
    if curl --fail --silent --output /dev/null "$url"; then return 0; fi
    sleep 1
  done
  return 1
}
phase=core-readiness
wait_health "http://127.0.0.1:$core_management_port/actuator/health/readiness" || fail
phase=be-readiness
for _ in $(seq 1 120); do
  migration_count="$(psql -X -d carelog_be_e2e -At -c "SELECT count(*) FROM public.flyway_schema_history WHERE success AND version IN ('1','2','3','4','5','6','7','8');" 2>/dev/null || true)"
  if [[ "$migration_count" == "8" ]]; then break; fi
  sleep 1
done
[[ "${migration_count:-}" == "8" ]] || fail
be_listener_ready=false
for _ in $(seq 1 30); do
  if curl --silent --output /dev/null --max-time 2 "http://127.0.0.1:$be_port/api/v1/actuator/health"; then
    be_listener_ready=true
    break
  fi
  sleep 1
done
[[ "$be_listener_ready" == true ]] || fail

phase=fixture-seed
if ! psql -X -v ON_ERROR_STOP=1 -d carelog_core_e2e >"$log_dir/core-seed.log" 2>&1 <<SQL
INSERT INTO identity.platform_accounts(id,status,primary_email,created_at,updated_at)
VALUES ('$account_a','ACTIVE','synthetic-a-${GITHUB_RUN_ID:-local}@invalid.test',now(),now()),
       ('$account_b','ACTIVE','synthetic-b-${GITHUB_RUN_ID:-local}@invalid.test',now(),now());
INSERT INTO identity.password_credentials(account_id,login_id,password_hash,created_at,updated_at)
VALUES ('$account_a','$login_a','$password_hash_a',now(),now()),
       ('$account_b','$login_b','$password_hash_b',now(),now());
SQL
then
  fail
fi
if ! psql -X -v ON_ERROR_STOP=1 -d carelog_be_e2e >"$log_dir/be-seed.log" 2>&1 <<SQL
INSERT INTO public.platform_accounts(id,status,primary_email,created_at,updated_at)
VALUES ('$account_a','ACTIVE','synthetic-a-${GITHUB_RUN_ID:-local}@invalid.test',now(),now()),
       ('$account_b','ACTIVE','synthetic-b-${GITHUB_RUN_ID:-local}@invalid.test',now(),now());
INSERT INTO public.users(public_id,account_id,organization_id,user_id,email,password,name,role,manager_type,created_at,updated_at)
VALUES ('$account_a','$account_a','$org_a','$login_a','synthetic-a-${GITHUB_RUN_ID:-local}@invalid.test','fixture-only','Synthetic manager A','MANAGER','PHYSICAL_THERAPIST',now(),now()),
       ('$account_b','$account_b','$org_b','$login_b','synthetic-b-${GITHUB_RUN_ID:-local}@invalid.test','fixture-only','Synthetic manager B','MANAGER','PHYSICAL_THERAPIST',now(),now());
INSERT INTO public.users(public_id,organization_id,name,role,customer_memo,created_at,updated_at)
VALUES ('$customer_id','$org_a','RPL64 synthetic customer','CUSTOMER','synthetic read-only fixture',now(),now());
INSERT INTO public.customer_events(public_id,organization_id,customer_id,status,scheduled_at,descriptor,note,created_at,updated_at)
SELECT '$event_id','$org_a',id,'PLANNED',
       ((now() at time zone 'Asia/Seoul')::date + time '12:00:00') at time zone 'Asia/Seoul',
       'RPL64 synthetic appointment','synthetic read-only fixture',now(),now()
FROM public.users WHERE public_id='$customer_id';
SQL
then
  fail
fi

phase=fixture-invariants-before
seed_counts="$(psql -X -d carelog_be_e2e -At -F '|' -c "SELECT (SELECT count(*) FROM public.users WHERE role='CUSTOMER'),(SELECT count(*) FROM public.customer_events),(SELECT count(*) FROM public.platform_accounts);" 2>"$log_dir/seed-counts.log")" || fail
[[ "$seed_counts" == "1|1|2" ]] || fail
customer_digest_before="$(psql -X -d carelog_be_e2e -At -c "SELECT md5(row_to_json(u)::text) FROM public.users u WHERE public_id='$customer_id';" 2>"$log_dir/customer-digest-before.log")" || fail
event_digest_before="$(psql -X -d carelog_be_e2e -At -c "SELECT md5(row_to_json(e)::text) FROM public.customer_events e WHERE public_id='$event_id';" 2>"$log_dir/event-digest-before.log")" || fail
[[ -n "$customer_digest_before" && -n "$event_digest_before" ]] || fail

phase=gateway-startup
setsid env \
  SPRING_PROFILES_ACTIVE=fixture \
  PLATFORM_ENVIRONMENT=test \
  PLATFORM_GATEWAY_PORT="$gateway_port" \
  SERVER_PORT="$gateway_port" \
  SERVER_ADDRESS=127.0.0.1 MANAGEMENT_SERVER_ADDRESS=127.0.0.1 \
  PLATFORM_GATEWAY_MANAGEMENT_PORT="$gateway_management_port" \
  PLATFORM_GATEWAY_REDIS_HOST=127.0.0.1 PLATFORM_GATEWAY_REDIS_PORT="$redis_port" \
  PLATFORM_GATEWAY_REDIS_KEY_PREFIX="rpl64-e2e:gateway:${GITHUB_RUN_ID:-local}:" \
  SPRING_DATA_REDIS_TIMEOUT=2s \
  PLATFORM_GATEWAY_AUTH_URI="http://127.0.0.1:$core_port" \
  PLATFORM_GATEWAY_CARELOG_BE_URI="http://127.0.0.1:$be_port" \
  PLATFORM_GATEWAY_CARELOG_RAG_URI=http://127.0.0.1:9 \
  PLATFORM_GATEWAY_JWT_VERIFICATION_SECRET="$jwt_secret" \
  PLATFORM_GATEWAY_INTERNAL_SECRET="$gateway_secret" \
  "$JAVA_HOME_17_X64/bin/java" -Xms64m -Xmx512m -jar "$gateway_jar" >"$log_dir/gateway.log" 2>&1 &
gateway_pid=$!
phase=gateway-readiness
wait_health "http://127.0.0.1:$gateway_management_port/actuator/health/readiness" || fail

phase=frontend-startup
mkdir -p "$carelog_fe_source/e2e-real"
install -m 0600 "$PWD/scripts/rpl64-hosted-synthetic-ab-browser.mjs" "$carelog_fe_source/e2e-real/rpl64-hosted-synthetic-ab.mjs"
setsid env \
  CARELOG_E2E_GATEWAY_TARGET="http://127.0.0.1:$gateway_port" \
  VITE_CARELOG_API_BASE_URL="http://127.0.0.1:$frontend_port" \
  pnpm --dir "$carelog_fe_source" exec vite --host 127.0.0.1 --port "$frontend_port" --strictPort --mode real-api-e2e \
  >"$log_dir/frontend.log" 2>&1 &
frontend_pid=$!
wait_health "http://127.0.0.1:$frontend_port/auth/login" || fail

phase=browser-account-ab
if browser_result="$(
  CARELOG_E2E_ORIGIN="http://127.0.0.1:$frontend_port" \
  CARELOG_E2E_LOGIN_A="$login_a" CARELOG_E2E_PASSWORD_A="$password_a" \
  CARELOG_E2E_LOGIN_B="$login_b" CARELOG_E2E_PASSWORD_B="$password_b" \
  CARELOG_E2E_CUSTOMER_ID="$customer_id" CARELOG_E2E_EVENT_ID="$event_id" \
  node "$carelog_fe_source/e2e-real/rpl64-hosted-synthetic-ab.mjs" 2>"$log_dir/browser.stderr"
)"; then
  browser_status=0
else
  browser_status=$?
fi
printf '%s\n' "$browser_result" >> "$GITHUB_STEP_SUMMARY"
browser_verdict="$(node -e 'try { process.stdout.write(JSON.parse(process.argv[1]).verdict || ""); } catch { process.stdout.write(""); }' "$browser_result")"
if [[ "$browser_status" -ne 0 || "$browser_verdict" != "PASS_BOUNDED_SYNTHETIC_ACCOUNT_AB_ISOLATION" ]]; then
  fail
fi

phase=fixture-invariants-after
after_counts="$(psql -X -d carelog_be_e2e -At -F '|' -c "SELECT (SELECT count(*) FROM public.users WHERE role='CUSTOMER'),(SELECT count(*) FROM public.customer_events),(SELECT count(*) FROM public.platform_accounts);" 2>"$log_dir/after-counts.log")" || fail
customer_digest_after="$(psql -X -d carelog_be_e2e -At -c "SELECT md5(row_to_json(u)::text) FROM public.users u WHERE public_id='$customer_id';" 2>"$log_dir/customer-digest-after.log")" || fail
event_digest_after="$(psql -X -d carelog_be_e2e -At -c "SELECT md5(row_to_json(e)::text) FROM public.customer_events e WHERE public_id='$event_id';" 2>"$log_dir/event-digest-after.log")" || fail
[[ "$after_counts" == "$seed_counts" && "$customer_digest_after" == "$customer_digest_before" && "$event_digest_after" == "$event_digest_before" ]] || fail

phase=complete
printf '\nScope: two ephemeral synthetic accounts; actual UI form login; post-login Customer readiness GETs consumed by Customers screens; Schedule screen GETs; list-only.\n' >> "$GITHUB_STEP_SUMMARY"
printf 'Browser API mutation attempts: 0 unexpected. Customer/Event row counts and seeded row digests matched before and after the browser flow.\n' >> "$GITHUB_STEP_SUMMARY"
printf 'No real accounts, GitHub secrets, production Identity, Docker bypass, artifacts, screenshots, traces, HAR, or service diagnostics were used or published.\n' >> "$GITHUB_STEP_SUMMARY"
