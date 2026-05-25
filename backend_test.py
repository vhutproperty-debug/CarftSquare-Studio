#!/usr/bin/env python3
"""
Backend API testing for Email lead notifications and anti-bot protection
Tests Resend email integration, honeypot validation, and email notification queue
"""

import requests
import json
import time
from datetime import datetime

# Configuration
BASE_URL = "https://paint-modern.preview.emergentagent.com/api"
ADMIN_EMAIL = "vhutproperty@gmail.com"
ADMIN_PASSWORD = "Aarush@12345"

# Session for maintaining cookies
session = requests.Session()

def print_test(test_num, description):
    print(f"\n{'='*80}")
    print(f"TEST {test_num}: {description}")
    print('='*80)

def print_result(success, message):
    status = "✅ PASS" if success else "❌ FAIL"
    print(f"{status}: {message}")

def print_data(label, data):
    print(f"\n{label}:")
    print(json.dumps(data, indent=2))

# Test 1: POST /api/leads with valid payload - should save lead and send email notification
print_test(1, "POST /api/leads with valid payload - verify lead creation and email notification")
try:
    payload = {
        "name": "Priya Mehta",
        "phone": "9876543210",
        "email": "priya.mehta@example.com",
        "service": "interior-painting",
        "location": "Andheri West, Mumbai",
        "bhk": "3BHK",
        "area": 1200,
        "paintQuality": "premium",
        "projectType": "repaint",
        "notes": "Need urgent painting for 3BHK apartment in Andheri West",
        "source": "website_lead_form"
    }
    
    response = requests.post(f"{BASE_URL}/leads", json=payload)
    print(f"Status Code: {response.status_code}")
    
    if response.status_code == 201:
        data = response.json()
        print_data("Response", data)
        
        # Verify required success message
        if "Thank you for contacting Brush & Bloom Painting Services. We will get back to you shortly." in data.get("message", ""):
            print_result(True, "Required success message present")
        else:
            print_result(False, f"Success message incorrect: {data.get('message')}")
        
        # Verify lead structure
        lead = data.get("lead", {})
        if lead.get("id") and lead.get("name") == "Priya Mehta":
            print_result(True, f"Lead created with UUID: {lead.get('id')}")
        else:
            print_result(False, "Lead structure incorrect")
        
        # Verify no _id field
        if "_id" not in lead:
            print_result(True, "No _id field in response (correct)")
        else:
            print_result(False, "_id field present in response")
        
        # Verify emailNotification status
        email_notif = lead.get("emailNotification", {})
        email_status = email_notif.get("status")
        notification_id = email_notif.get("notificationId")
        
        print(f"\nEmail Notification Status: {email_status}")
        print(f"Notification ID: {notification_id}")
        
        if email_status in ["sent", "failed"]:
            print_result(True, f"Email notification status is '{email_status}' (expected sent or failed)")
            if email_status == "failed":
                print(f"Failure Reason: {email_notif.get('failureReason', 'N/A')}")
                print("NOTE: Email may fail if Resend domain is not verified - this is acceptable if lead is saved")
        else:
            print_result(False, f"Unexpected email notification status: {email_status}")
        
        # Store lead ID for later verification
        test1_lead_id = lead.get("id")
        test1_notification_id = notification_id
    else:
        print_result(False, f"Expected 201, got {response.status_code}: {response.text}")
        test1_lead_id = None
        test1_notification_id = None
        
except Exception as e:
    print_result(False, f"Exception: {str(e)}")
    test1_lead_id = None
    test1_notification_id = None

# Test 2: Verify email_notifications record in DB by checking via admin endpoint
print_test(2, "Verify email_notifications record exists with correct details")
try:
    # First login as admin
    login_response = session.post(f"{BASE_URL}/auth/login", json={
        "email": ADMIN_EMAIL,
        "password": ADMIN_PASSWORD
    })
    
    if login_response.status_code == 200:
        print_result(True, "Admin login successful")
        
        # Get all leads to verify the lead exists
        leads_response = session.get(f"{BASE_URL}/admin/leads")
        if leads_response.status_code == 200:
            leads_data = leads_response.json()
            leads = leads_data.get("leads", [])
            
            # Find our test lead
            test_lead = None
            for lead in leads:
                if lead.get("id") == test1_lead_id:
                    test_lead = lead
                    break
            
            if test_lead:
                print_result(True, f"Lead found in database: {test_lead.get('name')}")
                
                # Verify email notification details
                email_notif = test_lead.get("emailNotification", {})
                print(f"\nEmail Notification Details:")
                print(f"  Status: {email_notif.get('status')}")
                print(f"  Notification ID: {email_notif.get('notificationId')}")
                print(f"  Failure Reason: {email_notif.get('failureReason', 'N/A')}")
                
                # Expected email details
                print(f"\nExpected Email Details:")
                print(f"  Subject: New Lead - Brush & Bloom Painting Services")
                print(f"  To: arunpandey@brushandbloom.space")
                print(f"  Customer Name: {test_lead.get('name')}")
                print(f"  Phone: {test_lead.get('phone')}")
                print(f"  Email: {test_lead.get('email')}")
                print(f"  Service: {test_lead.get('service')}")
                print(f"  Source: {test_lead.get('source')}")
                
                if email_notif.get("status") == "sent":
                    print_result(True, "Email notification sent successfully via Resend")
                elif email_notif.get("status") == "failed":
                    print_result(True, f"Email notification failed (acceptable if domain not verified): {email_notif.get('failureReason')}")
                else:
                    print_result(False, f"Unexpected email status: {email_notif.get('status')}")
            else:
                print_result(False, f"Lead {test1_lead_id} not found in database")
        else:
            print_result(False, f"Failed to get leads: {leads_response.status_code}")
    else:
        print_result(False, f"Admin login failed: {login_response.status_code}")
        
except Exception as e:
    print_result(False, f"Exception: {str(e)}")

# Test 3: POST /api/leads with honeypot field - should return success but NOT create lead
print_test(3, "POST /api/leads with honeypot 'website' field - anti-bot protection")
try:
    honeypot_payload = {
        "name": "Bot User",
        "phone": "1234567890",
        "email": "bot@spam.com",
        "service": "interior-painting",
        "website": "http://spam-site.com",  # Honeypot field
        "notes": "This is a bot submission"
    }
    
    response = requests.post(f"{BASE_URL}/leads", json=honeypot_payload)
    print(f"Status Code: {response.status_code}")
    
    if response.status_code == 201:
        data = response.json()
        print_data("Response", data)
        
        # Should return success-like message
        if "Thank you for contacting Brush & Bloom Painting Services" in data.get("message", ""):
            print_result(True, "Success-like message returned (bot doesn't know it was blocked)")
        else:
            print_result(False, "Unexpected message")
        
        # Should NOT have lead in response
        if "lead" not in data or not data.get("lead"):
            print_result(True, "No lead object in response (correctly blocked)")
        else:
            print_result(False, "Lead object present - honeypot validation failed!")
            
        # Verify lead was NOT created in database
        time.sleep(1)  # Brief wait
        leads_response = session.get(f"{BASE_URL}/admin/leads")
        if leads_response.status_code == 200:
            leads = leads_response.json().get("leads", [])
            bot_lead_found = any(lead.get("email") == "bot@spam.com" for lead in leads)
            
            if not bot_lead_found:
                print_result(True, "Bot lead NOT found in database (correctly blocked)")
            else:
                print_result(False, "Bot lead found in database - honeypot failed!")
        else:
            print(f"Could not verify database (status {leads_response.status_code})")
    else:
        print_result(False, f"Expected 201, got {response.status_code}: {response.text}")
        
except Exception as e:
    print_result(False, f"Exception: {str(e)}")

# Test 4: POST /api/vendors with valid payload - should save vendor and send email
print_test(4, "POST /api/vendors with valid payload - verify vendor creation and email notification")
try:
    vendor_payload = {
        "name": "Rajesh Painting Contractors",
        "phone": "9123456789",
        "email": "rajesh.painters@example.com",
        "cityArea": "Malad West, Mumbai",
        "servicesOffered": ["Interior Painting", "Exterior Painting", "Waterproofing"],
        "yearsExperience": 15,
        "teamSize": 10,
        "gstPan": "ABCDE1234F",
        "portfolioNotes": "Specialized in residential painting projects across Mumbai",
        "source": "vendor_registration_form"
    }
    
    response = requests.post(f"{BASE_URL}/vendors", json=vendor_payload)
    print(f"Status Code: {response.status_code}")
    
    if response.status_code == 201:
        data = response.json()
        print_data("Response", data)
        
        # Verify required success message
        if "Thank you for contacting Brush & Bloom Painting Services" in data.get("message", ""):
            print_result(True, "Required success message present")
        else:
            print_result(False, f"Success message incorrect: {data.get('message')}")
        
        # Verify vendor structure
        vendor = data.get("vendor", {})
        if vendor.get("id") and vendor.get("name") == "Rajesh Painting Contractors":
            print_result(True, f"Vendor created with UUID: {vendor.get('id')}")
        else:
            print_result(False, "Vendor structure incorrect")
        
        # Verify emailNotification status
        email_notif = vendor.get("emailNotification", {})
        email_status = email_notif.get("status")
        
        print(f"\nEmail Notification Status: {email_status}")
        
        if email_status in ["sent", "failed"]:
            print_result(True, f"Email notification status is '{email_status}'")
            if email_status == "failed":
                print(f"Failure Reason: {email_notif.get('failureReason', 'N/A')}")
        else:
            print_result(False, f"Unexpected email notification status: {email_status}")
            
        test4_vendor_id = vendor.get("id")
    else:
        print_result(False, f"Expected 201, got {response.status_code}: {response.text}")
        test4_vendor_id = None
        
except Exception as e:
    print_result(False, f"Exception: {str(e)}")
    test4_vendor_id = None

# Test 5: POST /api/vendors with honeypot field - should return success but NOT create vendor
print_test(5, "POST /api/vendors with honeypot 'website' field - anti-bot protection")
try:
    honeypot_vendor = {
        "name": "Spam Vendor",
        "phone": "9999999999",
        "email": "spam@vendor.com",
        "cityArea": "Mumbai",
        "servicesOffered": ["Painting"],
        "website": "http://spam-vendor.com",  # Honeypot field
    }
    
    response = requests.post(f"{BASE_URL}/vendors", json=honeypot_vendor)
    print(f"Status Code: {response.status_code}")
    
    if response.status_code == 201:
        data = response.json()
        print_data("Response", data)
        
        # Should return success-like message
        if "Thank you for contacting Brush & Bloom Painting Services" in data.get("message", ""):
            print_result(True, "Success-like message returned (bot doesn't know it was blocked)")
        else:
            print_result(False, "Unexpected message")
        
        # Should NOT have vendor in response
        if "vendor" not in data or not data.get("vendor"):
            print_result(True, "No vendor object in response (correctly blocked)")
        else:
            print_result(False, "Vendor object present - honeypot validation failed!")
            
        # Verify vendor was NOT created in database
        time.sleep(1)
        vendors_response = session.get(f"{BASE_URL}/admin/vendors")
        if vendors_response.status_code == 200:
            vendors = vendors_response.json().get("vendors", [])
            spam_vendor_found = any(v.get("email") == "spam@vendor.com" for v in vendors)
            
            if not spam_vendor_found:
                print_result(True, "Spam vendor NOT found in database (correctly blocked)")
            else:
                print_result(False, "Spam vendor found in database - honeypot failed!")
        else:
            print(f"Could not verify database (status {vendors_response.status_code})")
    else:
        print_result(False, f"Expected 201, got {response.status_code}: {response.text}")
        
except Exception as e:
    print_result(False, f"Exception: {str(e)}")

# Test 6: POST /api/enquiry-events with whatsapp_click - should create event and email notification
print_test(6, "POST /api/enquiry-events with type whatsapp_click - verify event and email")
try:
    event_payload = {
        "type": "whatsapp_click",
        "name": "Amit Kumar",
        "phone": "9876501234",
        "service": "WhatsApp enquiry - Interior Painting",
        "message": "User clicked WhatsApp button from homepage hero section",
        "source": "homepage_hero_whatsapp_button"
    }
    
    response = requests.post(f"{BASE_URL}/enquiry-events", json=event_payload)
    print(f"Status Code: {response.status_code}")
    
    if response.status_code == 200:
        data = response.json()
        print_data("Response", data)
        
        if data.get("tracked") == True:
            print_result(True, "Enquiry event tracked successfully")
            print("NOTE: Email notification should be queued for this event")
        else:
            print_result(False, "Event not tracked")
    else:
        print_result(False, f"Expected 200, got {response.status_code}: {response.text}")
        
except Exception as e:
    print_result(False, f"Exception: {str(e)}")

# Test 7: Unauthenticated POST /api/admin/email/retry - should return 401
print_test(7, "Unauthenticated POST /api/admin/email/retry - verify 401")
try:
    # Create new session without auth
    unauth_session = requests.Session()
    response = unauth_session.post(f"{BASE_URL}/admin/email/retry")
    print(f"Status Code: {response.status_code}")
    
    if response.status_code == 401:
        data = response.json()
        print_data("Response", data)
        print_result(True, "Correctly returns 401 for unauthenticated request")
    else:
        print_result(False, f"Expected 401, got {response.status_code}: {response.text}")
        
except Exception as e:
    print_result(False, f"Exception: {str(e)}")

# Test 8: Authenticated POST /api/admin/email/retry - should return retried count
print_test(8, "Authenticated POST /api/admin/email/retry - verify retry functionality")
try:
    # Use existing authenticated session
    response = session.post(f"{BASE_URL}/admin/email/retry")
    print(f"Status Code: {response.status_code}")
    
    if response.status_code == 200:
        data = response.json()
        print_data("Response", data)
        
        if "retried" in data and "message" in data:
            retried_count = data.get("retried", 0)
            print_result(True, f"Email retry endpoint working - retried {retried_count} notifications")
            print(f"Message: {data.get('message')}")
        else:
            print_result(False, "Response missing retried count or message")
    else:
        print_result(False, f"Expected 200, got {response.status_code}: {response.text}")
        
except Exception as e:
    print_result(False, f"Exception: {str(e)}")

# Test 9: Verify existing lead APIs still work
print_test(9, "Verify existing lead CRUD APIs still work")
try:
    # GET /api/admin/leads
    leads_response = session.get(f"{BASE_URL}/admin/leads")
    print(f"GET /api/admin/leads Status: {leads_response.status_code}")
    
    if leads_response.status_code == 200:
        leads_data = leads_response.json()
        leads = leads_data.get("leads", [])
        print_result(True, f"GET /api/admin/leads working - {len(leads)} leads found")
        
        # Verify our test lead is in the list
        test_lead_found = any(lead.get("id") == test1_lead_id for lead in leads)
        if test_lead_found:
            print_result(True, f"Test lead {test1_lead_id} found in leads list")
        else:
            print(f"Note: Test lead {test1_lead_id} not found (may have been cleaned up)")
    else:
        print_result(False, f"GET /api/admin/leads failed: {leads_response.status_code}")
    
    # GET /api/admin/dashboard
    dashboard_response = session.get(f"{BASE_URL}/admin/dashboard")
    print(f"\nGET /api/admin/dashboard Status: {dashboard_response.status_code}")
    
    if dashboard_response.status_code == 200:
        dashboard_data = dashboard_response.json()
        print_result(True, "GET /api/admin/dashboard working")
        print(f"Total Leads: {dashboard_data.get('totalLeads', 0)}")
        print(f"New Leads: {dashboard_data.get('newLeads', 0)}")
    else:
        print_result(False, f"GET /api/admin/dashboard failed: {dashboard_response.status_code}")
        
except Exception as e:
    print_result(False, f"Exception: {str(e)}")

# Test 10: Verify existing vendor APIs still work
print_test(10, "Verify existing vendor APIs still work")
try:
    # GET /api/admin/vendors
    vendors_response = session.get(f"{BASE_URL}/admin/vendors")
    print(f"GET /api/admin/vendors Status: {vendors_response.status_code}")
    
    if vendors_response.status_code == 200:
        vendors_data = vendors_response.json()
        vendors = vendors_data.get("vendors", [])
        print_result(True, f"GET /api/admin/vendors working - {len(vendors)} vendors found")
        
        # Verify our test vendor is in the list
        test_vendor_found = any(v.get("id") == test4_vendor_id for v in vendors)
        if test_vendor_found:
            print_result(True, f"Test vendor {test4_vendor_id} found in vendors list")
        else:
            print(f"Note: Test vendor {test4_vendor_id} not found")
    else:
        print_result(False, f"GET /api/admin/vendors failed: {vendors_response.status_code}")
        
except Exception as e:
    print_result(False, f"Exception: {str(e)}")

# Logout
try:
    logout_response = session.post(f"{BASE_URL}/auth/logout")
    if logout_response.status_code == 200:
        print(f"\n{'='*80}")
        print("Admin logout successful")
        print('='*80)
except:
    pass

print(f"\n{'='*80}")
print("BACKEND TESTING COMPLETE")
print('='*80)
print("\nSUMMARY:")
print("- Email lead notifications tested with Resend API")
print("- Anti-bot honeypot protection tested for leads and vendors")
print("- Email notification queue and retry mechanism tested")
print("- Enquiry events tracking tested")
print("- Admin email retry endpoint tested")
print("- Existing lead and vendor APIs verified")
print("\nNOTE: Real email delivery may fail if Resend domain is not verified.")
print("This is acceptable as long as leads/vendors are saved and email_notifications")
print("records capture the failed status with failure reason for retry.")
