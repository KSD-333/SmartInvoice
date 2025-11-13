# Email Notification Setup Guide

## Overview
The invoice system includes email notification functionality to notify vendors/users when their invoice payment status changes to "paid".

## Current Implementation
- ✅ Database trigger tracks when invoices are marked as 'paid'
- ✅ `notification_sent` flag prevents duplicate notifications
- ✅ Backend endpoints ready for email integration
- ⏳ Actual email sending requires configuration (see below)

## Backend Endpoints

### 1. Send Single Notification
```
POST /send_payment_notification?invoice_id={invoice_id}
```
Sends notification for a specific invoice that was just paid.

### 2. Send Bulk Notifications
```
POST /send_bulk_notifications
```
Sends notifications for all unpaid invoices with status='paid' and notification_sent=false.

## Email Service Integration Options

### Option 1: SendGrid (Recommended)
**Pros:** Easy setup, generous free tier (100 emails/day), reliable delivery

**Setup:**
1. Sign up at https://sendgrid.com/
2. Create API key
3. Install Python package:
   ```bash
   pip install sendgrid
   ```
4. Add to `.env`:
   ```
   SENDGRID_API_KEY=your_key_here
   SENDGRID_FROM_EMAIL=noreply@yourdomain.com
   ```
5. Update `backend/main.py` in notification functions:
   ```python
   from sendgrid import SendGridAPIClient
   from sendgrid.helpers.mail import Mail
   
   sg = SendGridAPIClient(os.getenv('SENDGRID_API_KEY'))
   
   message = Mail(
       from_email=os.getenv('SENDGRID_FROM_EMAIL'),
       to_emails=user_email,
       subject=f'Payment Released - Invoice {invoice["invoice_number"]}',
       html_content=f'''
           <h2>Payment Notification</h2>
           <p>Hi {user_name},</p>
           <p>Your payment of <strong>${invoice["amount"]}</strong> for invoice 
              <strong>{invoice["invoice_number"]}</strong> has been released.</p>
           <p>Vendor: {invoice["vendor_name"]}</p>
           <p>Payment Date: {datetime.now().strftime("%B %d, %Y")}</p>
       '''
   )
   sg.send(message)
   ```

### Option 2: AWS SES
**Pros:** Very cheap at scale, integrated with AWS

**Setup:**
1. Go to AWS Console → SES
2. Verify sender email
3. Create SMTP credentials
4. Install package:
   ```bash
   pip install boto3
   ```
5. Add to `.env`:
   ```
   AWS_ACCESS_KEY_ID=your_key
   AWS_SECRET_ACCESS_KEY=your_secret
   AWS_SES_REGION=us-east-1
   ```

### Option 3: Gmail SMTP
**Pros:** Free, no signup needed if you have Gmail

**Setup:**
1. Enable 2FA on Gmail account
2. Generate App Password: https://myaccount.google.com/apppasswords
3. Install package:
   ```bash
   pip install python-dotenv
   ```
4. Add to `.env`:
   ```
   SMTP_SERVER=smtp.gmail.com
   SMTP_PORT=587
   SMTP_USERNAME=your-email@gmail.com
   SMTP_PASSWORD=your-app-password
   ```
5. Update notification function:
   ```python
   import smtplib
   from email.mime.text import MIMEText
   from email.mime.multipart import MIMEMultipart
   
   msg = MIMEMultipart('alternative')
   msg['Subject'] = f'Payment Released - Invoice {invoice["invoice_number"]}'
   msg['From'] = os.getenv('SMTP_USERNAME')
   msg['To'] = user_email
   
   html = f'''
   <html>
     <body>
       <h2>Payment Notification</h2>
       <p>Hi {user_name},</p>
       <p>Your payment of <strong>${invoice["amount"]}</strong> for invoice 
          <strong>{invoice["invoice_number"]}</strong> has been released.</p>
     </body>
   </html>
   '''
   
   msg.attach(MIMEText(html, 'html'))
   
   with smtplib.SMTP(os.getenv('SMTP_SERVER'), int(os.getenv('SMTP_PORT'))) as server:
       server.starttls()
       server.login(os.getenv('SMTP_USERNAME'), os.getenv('SMTP_PASSWORD'))
       server.send_message(msg)
   ```

### Option 4: Resend (Modern Alternative)
**Pros:** Developer-friendly, great documentation, generous free tier

**Setup:**
1. Sign up at https://resend.com/
2. Get API key
3. Install:
   ```bash
   pip install resend
   ```
4. Very simple integration:
   ```python
   import resend
   resend.api_key = os.getenv("RESEND_API_KEY")
   
   resend.Emails.send({
       "from": "noreply@yourdomain.com",
       "to": user_email,
       "subject": f"Payment Released - Invoice {invoice['invoice_number']}",
       "html": f"<p>Hi {user_name}, your payment has been released...</p>"
   })
   ```

## Testing Notifications

### Manual Test (Single Invoice)
1. Mark an invoice as 'paid' in admin panel
2. Call endpoint:
   ```bash
   curl -X POST "http://localhost:8000/send_payment_notification?invoice_id=YOUR_INVOICE_ID"
   ```

### Bulk Test
```bash
curl -X POST "http://localhost:8000/send_bulk_notifications"
```

### Frontend Integration
Add a "Send Notifications" button in admin panel to trigger bulk notifications.

## Auto-Notification via Database Trigger
The SQL migration includes a trigger that sets `notification_sent=false` when status changes to 'paid'. 

**To enable auto-send:**
1. Create a cron job or scheduled task
2. Call `/send_bulk_notifications` every hour
3. Or use Supabase Edge Functions with database webhooks

## Email Template Customization
Update the email content in `backend/main.py` notification functions with:
- Company logo
- Custom styling
- Invoice PDF attachment
- Payment receipt link
- Support contact info

## Security Notes
- Never commit email credentials to git
- Use environment variables for all secrets
- Enable rate limiting for email endpoints
- Add email validation to prevent spam
- Consider using email verification before sending

## Future Enhancements
- [ ] HTML email templates with CSS
- [ ] PDF invoice attachment
- [ ] Multiple email languages
- [ ] SMS notifications for urgent invoices
- [ ] Email delivery tracking
- [ ] Unsubscribe functionality
- [ ] Email preferences per user
