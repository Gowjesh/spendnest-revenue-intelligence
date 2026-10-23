# [M10] Billing workflow walkthrough

- **Source Type**: meeting
- **Source ID**: `337f297d-9385-5b82-9e54-5019c1ed912c`
- **Assigned Route**: **Internal Enablement & Training**
- **Revision**: 1
- **Has Usable Transcript**: Yes

## Meeting Metadata
- **Organizer**: team12@example.com
- **Duration**: 0 minutes
- **Scheduled Time**: N/A

## Meeting Transcript (20 turns)

**Turn undefined [Team member A]:** I am finishing another call. Give me a couple of minutes and I will be back for the session.

**Turn undefined [Team member B]:** I do not think the optional attendee is joining. We can wait for the trainer to return.

**Turn undefined [Team member A]:** Yesterday we covered the subscription side of billing. Any questions before I show the remaining part, how invoices are generated and cleared?

**Turn undefined [Team member B]:** I have access to a demo account as an administrator, but I do not have the back-office super-admin access you mentioned.

**Turn undefined [Team member A]:** Okay. That is a different application. Operations uses it to create accounts, control enabled features and manage billing. I will show what it looks like, rather than ask you to create an invoice yourself.

**Turn undefined [Team member A]:** Remember the subscription can include fixed, variable and one-time components. There may also be usage charges. When a customer chooses a plan, operations creates the invoice with the customer and plan details.

**Turn undefined [Team member A]:** The nominal due period is seven days, but we sometimes give the customer until the end of the month. When you report payments, an invoice dated in an earlier month might have been cleared later, so check the dates rather than assuming they match.

**Turn undefined [Team member A]:** There is a further exception for invoices raised in the last week of the month: the customer may be allowed until the middle of the next month. If that period is exceeded, we may void and reissue. The displayed due date and the allowed collection period are not always the same thing.

**Turn undefined [Team member C]:** Understood. That explains why the invoice month alone does not tell us when the cash arrived.

**Turn undefined [Team member A]:** You can add a one-time customisation line as well as the subscription. If only half is being collected upfront, the invoice should describe that instalment instead of making it look like the whole charge.

**Turn undefined [Team member A]:** The tax presentation can be one integrated line or split components depending on the entity information. The demonstration changes when I update that field. This is part of the configuration the operations team needs to get right.

**Turn undefined [Team member A]:** After the first payment, we configure the billing cycle for the account. Monthly, quarterly and annual customers do not all receive the same subscription charge every month.

**Turn undefined [Team member A]:** You will also see zero-value invoices. If a periodic invoice has no subscription charge due and no extra usage component, its value can be zero. That is not automatically a missing payment.

**Turn undefined [Team member A]:** For the automated engine, invoice generation is at midnight in the customer's local time, with a later scheduled attempt to deduct the balance. Manual invoices are separate. There is a gap between generating an invoice and clearing it.

**Turn undefined [Team member A]:** Suppose the invoice is INR 6,240 but the wallet contains INR 6,110. The deduction fails and a notification goes out. The system tries three times. Adding money afterwards does not mean it was available when that earlier attempt happened.

**Turn undefined [Team member A]:** On the third day it tries again, but spending may have reduced the wallet balance. The next attempt can fail too. It repeats on the seventh day, now with a warning that another failure will freeze the account. The account manager receives the notices and can follow up before that point.

**Turn undefined [Team member A]:** On the tenth day, if there is enough money, the invoice clears and the next billing date moves forward. If it still fails, payments and cards can be blocked, and the billing date stays stuck. Simply topping up a frozen account does not complete the whole recovery flow in this process.

**Turn undefined [Team member A]:** The customer must tell us, then operations clears the outstanding invoice and unfreezes the account. Operations also needs to adjust the next billing date manually. Clearing the payment without checking that date can leave the next cycle wrong.

**Turn undefined [Team member B]:** No further question from me on that part.

**Turn undefined [Team member A]:** I will request the back-office access separately for the next training session. If questions come up when you review the billing examples, send them over and we will take them up.

