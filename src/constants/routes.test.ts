import {
  APP_ROUTE_PATHS,
  buildAppCustomerCreatePath,
  buildAppCustomerDetailPath,
  buildAppCustomerEditPath,
  buildAppCustomerHandoffPath,
  buildAppCustomerImportPath,
  buildAppCustomersPath,
  buildAppEventCreatePath,
  buildAppEventDetailPath,
  buildAppFollowUpsPath,
  buildAppHomePath,
  buildAppReviewDetailPath,
  buildAppSchedulePath,
  buildPublicFeaturesPath,
  buildPublicHomePath,
  isSupportedLocale,
} from '@/constants/routes';

describe('route contract', () => {
  it('builds the fixed public and app paths', () => {
    expect(buildPublicHomePath('ko')).toBe('/ko');
    expect(buildPublicFeaturesPath('en')).toBe('/en/features');
    expect(buildAppHomePath()).toBe('/app');
    expect(buildAppSchedulePath()).toBe('/app/schedule');
    expect(buildAppCustomersPath()).toBe('/app/customers');
    expect(buildAppCustomerCreatePath()).toBe('/app/customers/new');
    expect(buildAppCustomerEditPath('c-1')).toBe('/app/customers/c-1/edit');
    expect(buildAppFollowUpsPath()).toBe('/app/follow-ups');
    expect(buildAppEventCreatePath()).toBe('/app/events/new');
    expect(APP_ROUTE_PATHS.customerDetail).toBe('/app/customers/:customerId');
    expect(APP_ROUTE_PATHS.reviewDetail).toBe('/app/reviews/:reviewId');
    expect(APP_ROUTE_PATHS.eventDetail).toBe('/app/events/:eventId');
  });

  it('encodes a customer identifier exactly once', () => {
    expect(buildAppCustomerDetailPath('folder/customer 1')).toBe(
      '/app/customers/folder%2Fcustomer%201',
    );
  });

  it('encodes a unicode customer identifier exactly once', () => {
    expect(buildAppCustomerDetailPath('한글 고객')).toBe(
      `/app/customers/${encodeURIComponent('한글 고객')}`,
    );
    expect(buildAppCustomerDetailPath('한글 고객')).not.toMatch(/%25/);
  });

  it('builds nested customer import and handoff paths under the customer detail path', () => {
    expect(buildAppCustomerImportPath('c-1')).toBe('/app/customers/c-1/import');
    expect(buildAppCustomerHandoffPath('c-1')).toBe('/app/customers/c-1/handoff');
  });

  it('encodes a review identifier exactly once', () => {
    expect(buildAppReviewDetailPath('r 1')).toBe('/app/reviews/r%201');
  });

  it('encodes an event identifier exactly once', () => {
    expect(buildAppEventDetailPath('event/1')).toBe('/app/events/event%2F1');
  });

  it('accepts only supported locales', () => {
    expect(isSupportedLocale('ko')).toBe(true);
    expect(isSupportedLocale('en')).toBe(true);
    expect(isSupportedLocale('fr')).toBe(false);
  });
});
