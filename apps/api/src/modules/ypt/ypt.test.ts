import { describeOpenAdultCheck } from '../../../test/open-adult-check';
import { givenYpt } from '../../../test/fixtures';

describeOpenAdultCheck({ path: (id) => `/v1/adults/${id}/ypt`, given: givenYpt });
