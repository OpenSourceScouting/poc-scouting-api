# Reserved test identities

Reserved test identities let you test a tool without real people's data. Each identity gives the same answer
on each check, in each environment. This page is for developers who build or test a tool that calls the API.

## Identities and answers

The table gives each identity and its answers:

| Member ID   | Last name        | YPT        | Membership | Positions in `test-org-1`       |
| ----------- | ---------------- | ---------- | ---------- | ------------------------------- |
| `000000001` | `Testcurrent`    | current    | current    | `committeeMember`, `unitLeader` |
| `000000002` | `Testnotcurrent` | notCurrent | notCurrent | none                            |

The sync must load these identities with the real data. On your computer, this command loads them:

```sh
npm run db:reset -w @scouting/api
```

For more fictional adults, one for each use case, see [Sample data](sample-data.md).

## Send a check

Send the last name in the JSON body, for example `{"lastName": "Testcurrent"}`. The positions check also needs
a sign-in token. To get a local token, run this command:

```sh
npm run dev:token -w @scouting/api
```

## Read an answer

Each valid check gets the status code `200`. The answer is in the field `status`.

The value `notCurrent` has three possible causes:

- The last name is wrong.
- The API does not know the member ID.
- The record is not current.

The answer does not tell you which cause applies. For the reasons, see the uniform answer rule in
[ADR 0006](adr/0006-adult-check-contract.md).

Member IDs are strings, so leading zeros are part of the ID. For example, `00000001` (eight digits) is a
different ID from `000000001` (nine digits).
