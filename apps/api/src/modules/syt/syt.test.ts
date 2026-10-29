import { describeOpenAdultCheck } from '../../../test/open-adult-check';
import { givenSyt } from '../../../test/fixtures';

describeOpenAdultCheck({ path: (id) => `/v1/adults/${id}/syt`, given: givenSyt });
