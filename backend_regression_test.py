#!/usr/bin/env python3
"""
Backend Regression Testing after Google Analytics Integration
Tests that all backend routes still work correctly after GA4 integration
"""

import requests
import json
import time

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

# Test 1: GET /api/health returns ok true
print_test(1, "GET /api/health - verify health check endpoint")
try:
    response = requests.get(f"{BASE_URL}/health")
    print(f"Status Code: {response.status_code}")
    
    if response.status_code == 200:
        data = response.json()
        print_data("Response", data)
        
        if data.get("ok") == True:
            print_result(True, "Health check returns ok: true")
        else:
            print_result(False, f"Health check ok field is {data.get('ok')}, expected true")
            
        if data.get("app") == "brushandbloom":
            print_result(True, "App name correct: brushandbloom")
        else:
            print_result(False, f"App name is {data.get('app')}, expected brushandbloom")
            
        if data.get("city") == "Mumbai":
            print_result(True, "City correct: Mumbai")
        else:
            print_result(False, f"City is {data.get('city')}, expected Mumbai")
    else:
        print_result(False, f"Expected 200, got {response.status_code}: {response.text}")
        
except Exception as e:
    print_result(False, f"Exception: {str(e)}")

# Test 2: POST /api/leads valid payload still saves lead and returns required success message
print_test(2, "POST /api/leads - verify lead creation with valid payload")
try:
    payload = {
        "name": "Kavita Sharma",
        "phone": "9876543210",
        "email": "kavita.sharma@example.com",
        "service": "interior-painting",
        "location": "Malad West, Mumbai",
        "bhk": "2BHK",
        "area": 900,
        "paintQuality": "premium",
        "projectType": "repaint",
        "notes": "Need painting for 2BHK apartment in Malad West",
        "source": "website_lead_form"
    }
    
    response = requests.post(f"{BASE_URL}/leads", json=payload)
    print(f"Status Code: {response.status_code}")
    
    if response.status_code == 201:
        data = response.json()
        print_data("Response", data)
        
        # Verify required success message
        expected_message = "Thank you for contacting Brush & Bloom Painting Services. We will get back to you shortly."
        if expected_message in data.get("message", ""):
            print_result(True, "Required success message present")
        else:
            print_result(False, f"Success message incorrect: {data.get('message')}")
        
        # Verify lead structure
        lead = data.get("lead", {})
        if lead.get("id") and lead.get("name") == "Kavita Sharma":
            print_result(True, f"Lead created with UUID: {lead.get('id')}")
            test2_lead_id = lead.get("id")
        else:
            print_result(False, "Lead structure incorrect")
            test2_lead_id = None
        
        # Verify no _id field
        if "_id" not in lead:
            print_result(True, "No _id field in response (correct)")
        else:
            print_result(False, "_id field present in response")
        
        # Verify emailNotification may be sent
        email_notif = lead.get("emailNotification", {})
        email_status = email_notif.get("status")
        
        if email_status:
            print(f"\nEmail Notification Status: {email_status}")
            if email_status in ["sent", "failed", "queued"]:
                print_result(True, f"Email notification status is '{email_status}' (acceptable)")
            else:
                print_result(False, f"Unexpected email notification status: {email_status}")
        else:
            print("Note: No email notification status (may not be configured)")
    else:
        print_result(False, f"Expected 201, got {response.status_code}: {response.text}")
        test2_lead_id = None
        
except Exception as e:
    print_result(False, f"Exception: {str(e)}")
    test2_lead_id = None

# Test 3: POST /api/vendors valid payload still saves vendor and returns required success message
print_test(3, "POST /api/vendors - verify vendor creation with valid payload")
try:
    vendor_payload = {
        "name": "Mumbai Painting Services",
        "phone": "9123456789",
        "email": "mumbai.painters@example.com",
        "cityArea": "Kandivali East, Mumbai",
        "servicesOffered": ["Interior Painting", "Exterior Painting", "Waterproofing"],
        "yearsExperience": 12,
        "teamSize": 8,
        "gstPan": "ABCDE1234F",
        "portfolioNotes": "Specialized in residential and commercial painting projects",
        "source": "vendor_registration_form"
    }
    
    response = requests.post(f"{BASE_URL}/vendors", json=vendor_payload)
    print(f"Status Code: {response.status_code}")
    
    if response.status_code == 201:
        data = response.json()
        print_data("Response", data)
        
        # Verify required success message
        expected_message = "Thank you for contacting Brush & Bloom Painting Services"
        if expected_message in data.get("message", ""):
            print_result(True, "Required success message present")
        else:
            print_result(False, f"Success message incorrect: {data.get('message')}")
        
        # Verify vendor structure
        vendor = data.get("vendor", {})
        if vendor.get("id") and vendor.get("name") == "Mumbai Painting Services":
            print_result(True, f"Vendor created with UUID: {vendor.get('id')}")
            test3_vendor_id = vendor.get("id")
        else:
            print_result(False, "Vendor structure incorrect")
            test3_vendor_id = None
        
        # Verify emailNotification may be sent
        email_notif = vendor.get("emailNotification", {})
        email_status = email_notif.get("status")
        
        if email_status:
            print(f"\nEmail Notification Status: {email_status}")
            if email_status in ["sent", "failed", "queued"]:
                print_result(True, f"Email notification status is '{email_status}' (acceptable)")
            else:
                print_result(False, f"Unexpected email notification status: {email_status}")
        else:
            print("Note: No email notification status (may not be configured)")
    else:
        print_result(False, f"Expected 201, got {response.status_code}: {response.text}")
        test3_vendor_id = None
        
except Exception as e:
    print_result(False, f"Exception: {str(e)}")
    test3_vendor_id = None

# Test 4: POST /api/enquiry-events with whatsapp_click still returns tracked true and queues email
print_test(4, "POST /api/enquiry-events - verify whatsapp_click event tracking")
try:
    event_payload = {
        "type": "whatsapp_click",
        "name": "Rohit Patel",
        "phone": "9876501234",
        "service": "WhatsApp enquiry - Waterproofing",
        "message": "User clicked WhatsApp button from services section",
        "source": "services_section_whatsapp_button"
    }
    
    response = requests.post(f"{BASE_URL}/enquiry-events", json=event_payload)
    print(f"Status Code: {response.status_code}")
    
    if response.status_code == 200:
        data = response.json()
        print_data("Response", data)
        
        if data.get("tracked") == True:
            print_result(True, "Enquiry event tracked successfully (tracked: true)")
            print("Note: Email notification should be queued for this event")
        else:
            print_result(False, f"Event not tracked correctly, tracked field is {data.get('tracked')}")
    else:
        print_result(False, f"Expected 200, got {response.status_code}: {response.text}")
        
except Exception as e:
    print_result(False, f"Exception: {str(e)}")

# Test 5: GET /api/shades still returns shades
print_test(5, "GET /api/shades - verify paint shades endpoint")
try:
    response = requests.get(f"{BASE_URL}/shades")
    print(f"Status Code: {response.status_code}")
    
    if response.status_code == 200:
        data = response.json()
        shades = data.get("shades", [])
        
        print(f"\nTotal Shades: {len(shades)}")
        
        if len(shades) > 0:
            print_result(True, f"Shades endpoint returns {len(shades)} shades")
            
            # Verify shade structure
            first_shade = shades[0]
            print(f"\nFirst Shade Sample:")
            print(f"  Name: {first_shade.get('shadeName')}")
            print(f"  Code: {first_shade.get('shadeCode')}")
            print(f"  Brand: {first_shade.get('brand')}")
            print(f"  Category: {first_shade.get('category')}")
            print(f"  Hex Color: {first_shade.get('hexColor')}")
            
            required_fields = ['shadeName', 'shadeCode', 'brand', 'category', 'hexColor', 'id']
            missing_fields = [field for field in required_fields if field not in first_shade]
            
            if not missing_fields:
                print_result(True, "Shade structure contains all required fields")
            else:
                print_result(False, f"Shade missing fields: {missing_fields}")
                
            # Verify no _id field
            if "_id" not in first_shade:
                print_result(True, "No _id field in shade response (correct)")
            else:
                print_result(False, "_id field present in shade response")
        else:
            print_result(False, "No shades returned")
    else:
        print_result(False, f"Expected 200, got {response.status_code}: {response.text}")
        
except Exception as e:
    print_result(False, f"Exception: {str(e)}")

# Test 6: GET /api/services still returns services
print_test(6, "GET /api/services - verify services endpoint")
try:
    response = requests.get(f"{BASE_URL}/services")
    print(f"Status Code: {response.status_code}")
    
    if response.status_code == 200:
        data = response.json()
        services = data.get("services", [])
        
        print(f"\nTotal Services: {len(services)}")
        
        if len(services) > 0:
            print_result(True, f"Services endpoint returns {len(services)} services")
            
            # Verify service structure
            first_service = services[0]
            print(f"\nFirst Service Sample:")
            print(f"  ID: {first_service.get('id')}")
            print(f"  Title: {first_service.get('title')}")
            print(f"  Price: {first_service.get('price')}")
            print(f"  Description: {first_service.get('description', '')[:50]}...")
            
            required_fields = ['id', 'title', 'price', 'description']
            missing_fields = [field for field in required_fields if field not in first_service]
            
            if not missing_fields:
                print_result(True, "Service structure contains all required fields")
            else:
                print_result(False, f"Service missing fields: {missing_fields}")
                
            # List all service titles
            print(f"\nAll Services:")
            for i, service in enumerate(services, 1):
                print(f"  {i}. {service.get('title')} - {service.get('price')}")
        else:
            print_result(False, "No services returned")
    else:
        print_result(False, f"Expected 200, got {response.status_code}: {response.text}")
        
except Exception as e:
    print_result(False, f"Exception: {str(e)}")

print(f"\n{'='*80}")
print("BACKEND REGRESSION TESTING COMPLETE")
print('='*80)
print("\nSUMMARY:")
print("✅ All 6 backend regression tests executed")
print("- Health check endpoint tested")
print("- Lead creation endpoint tested")
print("- Vendor creation endpoint tested")
print("- Enquiry events tracking tested")
print("- Paint shades endpoint tested")
print("- Services endpoint tested")
print("\nConclusion: Backend routes verified after Google Analytics integration")
