# Groups: archive, delete, and adding an expense

## Archive (any member)
`POST /groups/:id/archive` hides the group from **my** list; `DELETE /groups/:id/archive` brings it back.
It only sets `GroupMember.archivedAt` on my row. Nobody else sees a change, and the group keeps all its
history. In the app: Group details > Group options > Archive group; Groups > Archived (n) > Restore.

## Delete (creator only)
`DELETE /groups/:id` is a **soft delete** (`Group.deletedAt`, `deletedById`).

Refused with 409 while:
- any share is unsettled (`GroupExpenseSplit.settled = false`, amount > 0): "Settle balances first";
- a settlement payment is in progress (`SettlementIntent` not settled and not expired).

When allowed, the group is gone for everyone: not in anyone's list, invitations to it disappear, the detail
answers 404, and it no longer counts in contact balances. Expenses, shares, members and the payments that
settled them stay in the database, and nobody's Activity (`Transaction` rows) is touched. Nothing on chain is
ever deleted.

## Adding an expense (app)
1. **Who paid?** The server records the person adding the expense as the payer, so this step says "You paid".
2. **Split how?** Equal / Custom amounts / %, with each person's share shown. People already in the group can
   be unticked (the payer always shares; at least one other person is needed). People who were invited and have
   not accepted are shown greyed ("Invited · can't share yet"): the server does not give them a share.
3. **Review.** "@alex owes you 25.00 USDC" for each person, then "Add expense".

The app always sends `splitWithUserIds` (the ticked people) and, for Custom and %, `customSplits` in whole
cents that add up to the total. The server rules of #75/#77 are unchanged.
