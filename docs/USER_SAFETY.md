# Reporting, blocking and group consent (App Store guideline 1.2)

## What a person can do

- **Report** another user, and **block** them, from: their profile (the contact page), a note they sent
  (the contact page and the payment detail), and a group (its people list, and each expense they added).
  A report has a reason, optional text (500 characters) and an "also block" switch, on by default.
- **Blocked users** (Profile > Safety) lists the people they blocked and undoes it. Profile > Safety also
  has "Report a problem", which writes to support@atara.finance.
- **Group invitations.** Someone added to a group by @handle is *invited*, not a member. They see the
  invitation on the Groups tab and accept, decline, or decline and block the person who added them. Until
  they accept they see nothing of the group, appear in no balance, and no expense share can be assigned to
  them (the service answers 409 "has not accepted the invitation"). Groups that existed before keep all their
  members as active.

## What a block does (both directions, whoever blocked)

- Neither person finds the other in search, by @handle, or in recent contacts. Every refusal reads as
  "not found": nobody is told they were blocked.
- Neither can add the other to a group (create or add members), and neither can be given a share in an
  expense the other adds.
- Notes written by the other person are hidden in Activity ("Note hidden"); the payment itself stays, because
  it is a record of money moved.
- Pending invitations between the two end.
- Payment requests and reminders: a payment request is a link shared outside ATARA, and a reminder is a
  message sent through the phone's share sheet. Nothing in ATARA's service targets a specific user with
  them, so the in-app way one person asks another for money is a group expense share, which the rules above
  cover. A blocked contact also disappears from the blocker's contacts, so no reminder can be started to them.
- A block cannot stop someone sending crypto to a public address on the Base network: that is how a
  self-custody wallet works. It stops them finding the person inside ATARA.

## Reports: where they go

- Stored in `UserReport` (reason, text, where it was seen, handle of the reported person at the time, status
  OPEN / REVIEWED / ACTIONED). The reported person is kept as an id and a handle with no foreign key, so a
  report outlives the account it is about. If the *reporter* deletes their account, the report is unlinked
  from them and their text is erased.
- An email goes to `support@atara.finance` (or `SAFETY_RECIPIENT_EMAIL`) through Resend, the same mailer as
  feedback. If the mailer is not configured or fails, the report is still stored and a log line
  (`user-report-email-skipped` / `user-report-email-failed`, with the report id only) is written.
- **Admin view**, two ways:
  - `node scripts/list-reports.cjs` in the Render Shell of the API (`ALL`, `REVIEWED`, or
    `done <reportId>` to mark one reviewed).
  - `GET /api/v1/safety/admin/reports?status=OPEN` and `PATCH /api/v1/safety/admin/reports/:id` with an
    `x-admin-token` header. They exist only when `SAFETY_ADMIN_TOKEN` (at least 24 characters) is set on the
    server; without it they answer 404 like an unknown route.

## NEEDS_HUMAN (nothing here is done by the code)

1. Deploy the backend (it runs `prisma migrate deploy`; the migration `20261004120000_user_safety` is
   additive) before shipping the app build that shows the new screens. An older app build keeps working:
   people it adds to a group are invited like anyone else, and an invited person simply appears as a member
   in its group screen until they accept.
2. Optional: set `SAFETY_ADMIN_TOKEN` on Render to use the HTTP admin view.
3. Optional: set `SAFETY_RECIPIENT_EMAIL` if reports should go somewhere other than support@atara.finance.
4. Confirm that support@atara.finance is read, and that you can keep the "within 24 hours" promise that the
   terms now make.
5. Review the added wording in the terms (section 6, and the website's /legal/terms) and in the privacy policy.
