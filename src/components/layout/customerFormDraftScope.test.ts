import { customerFormDraftScopeKey } from '@/components/layout/customerFormDraftScope';

describe('customerFormDraftScopeKey (draft reset contract)', () => {
  it('keeps customer routes keyed per path, so a draft never leaks between customer screens', () => {
    expect(customerFormDraftScopeKey('/app/customers/new')).toBe('/app/customers/new');
    expect(customerFormDraftScopeKey('/app/customers/a')).not.toBe(
      customerFormDraftScopeKey('/app/customers/b'),
    );
    expect(customerFormDraftScopeKey('/app/customers/a/edit')).not.toBe(
      customerFormDraftScopeKey('/app/customers/a'),
    );
  });

  it('does not change the key between non-customer screens (no remount of the app tree on save)', () => {
    expect(customerFormDraftScopeKey('/app/schedule')).toBe(
      customerFormDraftScopeKey('/app/events/new'),
    );
    expect(customerFormDraftScopeKey('/app/events/abc')).toBe(
      customerFormDraftScopeKey('/app/schedule'),
    );
  });

  it('changes the key when entering or leaving customer routes, so the draft resets there', () => {
    expect(customerFormDraftScopeKey('/app/customers/new')).not.toBe(
      customerFormDraftScopeKey('/app/schedule'),
    );
    expect(customerFormDraftScopeKey('/app/schedule')).not.toBe(
      customerFormDraftScopeKey('/app/customers/new'),
    );
  });

  it('keeps the assistant question draft reset on every entry to and exit from the assistant route', () => {
    expect(customerFormDraftScopeKey('/app/assistant')).not.toBe(
      customerFormDraftScopeKey('/app/schedule'),
    );
    expect(customerFormDraftScopeKey('/app/schedule')).not.toBe(
      customerFormDraftScopeKey('/app/assistant'),
    );
  });
});
