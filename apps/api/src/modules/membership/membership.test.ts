import { describeOpenAdultCheck } from '../../../test/open-adult-check';
import { givenMembership } from '../../../test/fixtures';

describeOpenAdultCheck({ path: (id) => `/v1/adults/${id}/membership`, given: givenMembership });
