# Mashhor Inspection System — Prototype

A standalone, clickable prototype of the vehicle-inspection workflow for client presentations.
It is one static file (`index.html`) with no build step, no backend and no dependencies.

- **Simulated:** all records are fictional sample data kept in this browser's `localStorage`.
  Name confirmations are checked against the demo account's name only. Nothing reaches the real API or database.
- **Separate from production:** nothing in `admin/`, `portal/`, `packages/shared/`, `Backend/` or the database is used or changed.
  The workflow rules are re-implemented in the `<script id="engine">` block to match
  `Backend/mashoor/src/inspections.js` and `routes/portal.js` / `routes/admin.js`, including status names and error messages.

## Run it

```sh
# from Listing-Sample/Mashoor
python -m http.server 4310 --directory prototype
# then open http://localhost:4310/
```

You can also open `prototype/index.html` directly in a browser.

## Using it in a presentation

- **Viewing as** (top bar) switches between the Admin website (Mashhor staff) and Portal accounts.
  No login is needed. If the new account can open the inspection you're on, you stay on it.
- **What happens next** (on every inspection) names who acts next and offers a "View as …" button for that person.
- **Reset demo** (press twice) restores the sample data.

### Demo accounts (fictional), organisation MGCSB

| Account | Portal role | Sign-off stage |
|---|---|---|
| Hafiz Kamal | Inspector | — (assigned inspector) |
| Daniel Wong | Inspector | — |
| Siti Aminah | Vendor / Client | — (verifies or requests re-check) |
| Azman Yusof | Inspector | Checked by (MGCSB Inspector) |
| Faridah Ismail | Vendor / Client | Agreed by (MINDEF) |
| Rashid Omar | Vendor / Client | Approved by (Head of Operations) |
| Kamarul Ariffin | Vendor / Client | Acknowledgement |

"Sample Fleet Sdn Bhd" has its own inspector and client, to show that each company sees only its own inspections.

### Walkthrough

1. **Admin → Inspections → + New inspection.** Choose MGCSB, Hafiz Kamal and a template (Forklift, Double Cab Hilux, Medium Bus or Large Bus), and enter at least one vehicle identifier.
2. **Hafiz Kamal.** Open it from *Assigned*. Every mark starts blank. Mark each item, add comments and click the diagram to record damage, then use **Save draft** and **Submit for verification**.
3. **Azman Yusof / Faridah Ismail.** They can confirm Checked by and Agreed by in either order once the inspection is submitted, by typing the account's full name.
4. **Siti Aminah.** **Request Re-check** (a reason is required) or **Submit to HOO Approval**.
   - On a re-check, Hafiz sees the reason, corrects the checklist and resubmits. That creates revision 2. Revision 1 stays frozen with its own sign-offs, and every stage starts again for revision 2.
5. **Rashid Omar.** **Approved by** opens only after client verification *and* both sign-offs on the current revision.
6. **Kamarul Ariffin.** Acknowledges revisions that have remarks. A revision with no remarks is auto-acknowledged. By default, a pending acknowledgement does **not** block approval (Admin → Vendors → MGCSB can switch that on).
7. **Print view.** Shows any submitted revision (current or earlier) on an A4 sheet with its checklist, remarks, damage and recorded sign-offs.

## Differences between the code and the original workflow brief

These come from the code review. The prototype follows the **code**.

- **Re-check status:** when the inspector saves a returned inspection, it stays `returned`. It does not go back to `draft`, and changes only when it is resubmitted (to `pending_verification`, as a new revision).
- **No Signatory role:** portal roles are only `client` and `inspector`. Admin assigns each sign-off stage to one account per company (Vendors → Inspection sign-offs).
  Because any `client` account of the company may verify, signatory accounts with the client role also see the *Client verification* panel.
- **Checked by / Agreed by** are open in both `pending_verification` and `pending_approval`. They can be signed before or after client verification, in either order.
- **Acknowledgement:** it blocks approval only when the per-company setting is on (off by default), and it can be completed after approval.
- **Submitting directly from Assigned** (without saving a draft first) is allowed. In that case no "Checklist started" event is recorded.
- **Dashboards:** the production admin dashboard covers catalog listings only. In the portal, clients land on *My Catalogs* and inspectors go to *Inspections*. Neither has an inspection dashboard, so the prototype opens on Inspections.
- **Admin's part:** admin creates inspections, can reassign the inspector or edit vehicle identifiers while the inspection is with the inspector, and can view, print and read history. Admin cannot verify, request a re-check or sign.
- **One form:** organisation, inspector, template and vehicle are chosen in a single *New inspection* form. The vehicle type comes from the template.

## Not included (exists in production)

Catalog listings, categories, My Catalogs, vendor/account creation and password management, and the checklist template editor (draft → preview → publish).
Checklist content uses short sample rows. The real templates also have vehicle-detail fields and measurements, which are not modelled here.
