import { createScoutingClient } from '@scouting/api-client';
import { info as contractInfo } from '../../../openapi/openapi.json';

const baseUrl = import.meta.env.VITE_API_URL ?? 'http://localhost:8787';
const client = createScoutingClient({ baseUrl });

const form = document.querySelector<HTMLFormElement>('#check')!;
const result = document.querySelector<HTMLOutputElement>('#result')!;
const positionsFields = document.querySelector<HTMLFieldSetElement>('#positions-fields')!;
document.querySelector('#api-url')!.textContent = baseUrl;
document.querySelector<HTMLAnchorElement>('#docs-link')!.href = `${baseUrl}/docs`;
document.querySelector<HTMLAnchorElement>('#spec-link')!.href = `${baseUrl}/openapi.json`;
// Read from the committed contract at build time, so the page always names the version it was built against.
document.querySelector('#contract-version')!.textContent = contractInfo.version;

form.check.addEventListener('change', () => {
  positionsFields.hidden = form.check.value !== 'positions';
});

async function runCheck(values: Record<string, string>) {
  // The last name is PII: it goes in the JSON body, never the URL.
  const path = { scoutingMemberId: values.memberId! };
  const body = { lastName: values.lastName! };
  switch (values.check) {
    case 'syt':
      return client.POST('/v1/adults/{scoutingMemberId}/syt', { params: { path }, body });
    case 'membership':
      return client.POST('/v1/adults/{scoutingMemberId}/membership', { params: { path }, body });
    default:
      return client.POST('/v1/adults/{scoutingMemberId}/organizations/{organizationId}/positions', {
        params: { path: { ...path, organizationId: values.organizationId! } },
        body,
        headers: { Authorization: `Bearer ${values.token}` },
      });
  }
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  const values = Object.fromEntries(new FormData(form)) as Record<string, string>;
  try {
    const { data, error } = await runCheck(values);
    if (error) {
      result.className = 'problem';
      result.textContent = `${error.status} ${error.title}${error.detail ? `: ${error.detail}` : ''}`;
      return;
    }
    // Open enum: anything other than "current" is treated as notCurrent.
    const current = data.status === 'current';
    result.className = current ? 'current' : 'notCurrent';
    const summary = current
      ? `Current until ${new Date(data.expiresAt!).toLocaleString()}.`
      : 'Not current, or the member ID and the last name do not match the records. The answer does not say which. ' +
        'Examine the spelling of both. The adult can sign in to my.scouting to see their own record.';
    result.textContent = `${summary}\n\n${JSON.stringify(data, null, 2)}`;
  } catch (err) {
    result.className = 'problem';
    result.textContent = `The API at ${baseUrl} did not answer. Make sure that \`npm run dev\` runs. (${String(err)})`;
  }
});
