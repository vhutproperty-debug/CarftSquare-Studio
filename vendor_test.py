#!/usr/bin/env python3
"""
Backend API Testing for Vendor Registration and Admin Approval Feature
Tests vendor creation, admin authentication, vendor management, and lead assignment
"""

import requests
import json
import sys
from datetime import datetime

BASE_URL = "https://paint-modern.preview.emergentagent.com/api"

# Admin credentials provided in review request
ADMIN_CREDENTIALS = {
    "email": "vhutproperty@gmail.com",
    "password": "Aarush@12345"
}

# Session storage
session_cookies = {}
test_vendor_id = None
test_lead_id = None

def print_test(name):
    print(f"\n{'='*80}")
    print(f"TEST: {name}")
    print('='*80)

def print_success(message):
    print(f"✅ SUCCESS: {message}")

def print_failure(message):
    print(f"❌ FAILURE: {message}")

def print_info(message):
    print(f"ℹ️  INFO: {message}")

# Test 1: Negative - POST /api/vendors with missing required fields
def test_vendor_creation_missing_fields():
    print_test("1. POST /api/vendors with missing required fields (should return 400)")
    
    test_cases = [
        {"name": "Test Vendor"},  # Missing phone, cityArea, servicesOffered
        {"name": "Test Vendor", "phone": "9876543210"},  # Missing cityArea, servicesOffered
        {"name": "Test Vendor", "phone": "9876543210", "cityArea": "Andheri"},  # Missing servicesOffered
        {"phone": "9876543210", "cityArea": "Andheri", "servicesOffered": ["Interior Painting"]},  # Missing name
        {"name": "Test Vendor", "phone": "123", "cityArea": "Andheri", "servicesOffered": ["Interior Painting"]},  # Invalid phone (too short)
    ]
    
    all_passed = True
    for i, payload in enumerate(test_cases, 1):
        try:
            response = requests.post(f"{BASE_URL}/vendors", json=payload, timeout=10)
            print_info(f"Test case {i}: Status {response.status_code}")
            
            if response.status_code == 400:
                print_success(f"Test case {i}: Correctly returned 400 for invalid payload")
            else:
                print_failure(f"Test case {i}: Expected 400, got {response.status_code}")
                all_passed = False
        except Exception as e:
            print_failure(f"Test case {i}: Exception - {str(e)}")
            all_passed = False
    
    return all_passed

# Test 2: Positive - POST /api/vendors with valid data
def test_vendor_creation_success():
    global test_vendor_id
    print_test("2. POST /api/vendors with valid data (should create vendor)")
    
    payload = {
        "name": "Rajesh Painting Contractors",
        "phone": "9876543210",
        "email": "rajesh@paintingcontractors.com",
        "cityArea": "Andheri West, Mumbai",
        "servicesOffered": ["Interior Painting", "Exterior Painting", "Waterproofing"],
        "yearsExperience": 12,
        "teamSize": 8,
        "gstPan": "ABCDE1234F",
        "portfolioNotes": "Specialized in premium residential projects across Mumbai. 500+ completed projects."
    }
    
    try:
        response = requests.post(f"{BASE_URL}/vendors", json=payload, timeout=10)
        print_info(f"Status: {response.status_code}")
        print_info(f"Response: {response.text}")
        
        if response.status_code == 201:
            data = response.json()
            vendor = data.get('vendor', {})
            
            # Verify all required fields
            checks = [
                ('id' in vendor and isinstance(vendor['id'], str) and len(vendor['id']) > 0, "UUID id present"),
                ('_id' not in vendor, "No _id field in response"),
                (vendor.get('status') == 'new', "Status is 'new'"),
                (vendor.get('name') == payload['name'], "Name matches"),
                (vendor.get('phone') == payload['phone'], "Phone matches"),
                (vendor.get('email') == payload['email'], "Email matches"),
                (vendor.get('cityArea') == payload['cityArea'], "CityArea matches"),
                (isinstance(vendor.get('servicesOffered'), list) and len(vendor.get('servicesOffered', [])) == 3, "ServicesOffered is array with 3 items"),
                (vendor.get('yearsExperience') == 12, "YearsExperience matches"),
                (vendor.get('teamSize') == 8, "TeamSize matches"),
                (vendor.get('gstPan') == payload['gstPan'], "GstPan matches"),
                (vendor.get('portfolioNotes') == payload['portfolioNotes'], "PortfolioNotes matches"),
                ('createdAt' in vendor, "CreatedAt present"),
                ('updatedAt' in vendor, "UpdatedAt present"),
            ]
            
            all_passed = True
            for check, description in checks:
                if check:
                    print_success(description)
                else:
                    print_failure(description)
                    all_passed = False
            
            if all_passed:
                test_vendor_id = vendor['id']
                print_info(f"Vendor ID saved: {test_vendor_id}")
                return True
            return False
        else:
            print_failure(f"Expected 201, got {response.status_code}")
            return False
    except Exception as e:
        print_failure(f"Exception: {str(e)}")
        return False

# Test 3: Unauthenticated GET /api/admin/vendors
def test_admin_vendors_unauthenticated():
    print_test("3. GET /api/admin/vendors without authentication (should return 401)")
    
    try:
        response = requests.get(f"{BASE_URL}/admin/vendors", timeout=10)
        print_info(f"Status: {response.status_code}")
        print_info(f"Response: {response.text}")
        
        if response.status_code == 401:
            print_success("Correctly returned 401 for unauthenticated request")
            return True
        else:
            print_failure(f"Expected 401, got {response.status_code}")
            return False
    except Exception as e:
        print_failure(f"Exception: {str(e)}")
        return False

# Test 4: Admin login
def test_admin_login():
    print_test("4. POST /api/auth/login with admin credentials")
    
    try:
        response = requests.post(
            f"{BASE_URL}/auth/login",
            json=ADMIN_CREDENTIALS,
            timeout=10
        )
        print_info(f"Status: {response.status_code}")
        print_info(f"Response: {response.text}")
        
        if response.status_code == 200:
            session_cookies.update(response.cookies.get_dict())
            data = response.json()
            user = data.get('user', {})
            
            checks = [
                (user.get('email') == ADMIN_CREDENTIALS['email'], f"Email matches: {user.get('email')}"),
                ('passwordHash' not in user, "No passwordHash in response"),
                ('_id' not in user, "No _id in response"),
                (len(session_cookies) > 0, "Session cookie stored"),
            ]
            
            all_passed = True
            for check, description in checks:
                if check:
                    print_success(description)
                else:
                    print_failure(description)
                    all_passed = False
            
            return all_passed
        else:
            print_failure(f"Expected 200, got {response.status_code}")
            return False
    except Exception as e:
        print_failure(f"Exception: {str(e)}")
        return False

# Test 5: Authenticated GET /api/admin/vendors
def test_admin_vendors_authenticated():
    print_test("5. GET /api/admin/vendors with authentication (should return vendors)")
    
    try:
        response = requests.get(
            f"{BASE_URL}/admin/vendors",
            cookies=session_cookies,
            timeout=10
        )
        print_info(f"Status: {response.status_code}")
        print_info(f"Response: {response.text[:500]}...")
        
        if response.status_code == 200:
            data = response.json()
            vendors = data.get('vendors', [])
            
            print_info(f"Total vendors returned: {len(vendors)}")
            
            # Find our test vendor
            test_vendor = None
            for vendor in vendors:
                if vendor.get('id') == test_vendor_id:
                    test_vendor = vendor
                    break
            
            if test_vendor:
                print_success(f"Found test vendor: {test_vendor.get('name')}")
                print_info(f"Vendor status: {test_vendor.get('status')}")
                return True
            else:
                print_failure(f"Test vendor with id {test_vendor_id} not found in response")
                return False
        else:
            print_failure(f"Expected 200, got {response.status_code}")
            return False
    except Exception as e:
        print_failure(f"Exception: {str(e)}")
        return False

# Test 6a: Update vendor status to 'contacted'
def test_update_vendor_status_contacted():
    print_test("6a. PUT /api/admin/vendors/:id - Update status to 'contacted'")
    
    try:
        payload = {
            "status": "contacted",
            "adminNotes": "Called vendor on phone. Discussed project requirements."
        }
        
        response = requests.put(
            f"{BASE_URL}/admin/vendors/{test_vendor_id}",
            json=payload,
            cookies=session_cookies,
            timeout=10
        )
        print_info(f"Status: {response.status_code}")
        print_info(f"Response: {response.text}")
        
        if response.status_code == 200:
            data = response.json()
            vendor = data.get('vendor', {})
            
            checks = [
                (vendor.get('status') == 'contacted', "Status updated to 'contacted'"),
                (vendor.get('adminNotes') == payload['adminNotes'], "AdminNotes updated"),
                (vendor.get('id') == test_vendor_id, "Vendor ID matches"),
            ]
            
            all_passed = True
            for check, description in checks:
                if check:
                    print_success(description)
                else:
                    print_failure(description)
                    all_passed = False
            
            return all_passed
        else:
            print_failure(f"Expected 200, got {response.status_code}")
            return False
    except Exception as e:
        print_failure(f"Exception: {str(e)}")
        return False

# Test 6b: Update vendor status to 'approved'
def test_update_vendor_status_approved():
    print_test("6b. PUT /api/admin/vendors/:id - Update status to 'approved'")
    
    try:
        payload = {
            "status": "approved",
            "adminNotes": "Vendor approved after verification. Ready for project assignments."
        }
        
        response = requests.put(
            f"{BASE_URL}/admin/vendors/{test_vendor_id}",
            json=payload,
            cookies=session_cookies,
            timeout=10
        )
        print_info(f"Status: {response.status_code}")
        print_info(f"Response: {response.text}")
        
        if response.status_code == 200:
            data = response.json()
            vendor = data.get('vendor', {})
            
            checks = [
                (vendor.get('status') == 'approved', "Status updated to 'approved'"),
                (vendor.get('adminNotes') == payload['adminNotes'], "AdminNotes updated"),
                (vendor.get('id') == test_vendor_id, "Vendor ID matches"),
            ]
            
            all_passed = True
            for check, description in checks:
                if check:
                    print_success(description)
                else:
                    print_failure(description)
                    all_passed = False
            
            return all_passed
        else:
            print_failure(f"Expected 200, got {response.status_code}")
            return False
    except Exception as e:
        print_failure(f"Exception: {str(e)}")
        return False

# Test 6c: Invalid status update
def test_update_vendor_invalid_status():
    print_test("6c. PUT /api/admin/vendors/:id - Invalid status (should return 400)")
    
    try:
        payload = {
            "status": "invalid_status"
        }
        
        response = requests.put(
            f"{BASE_URL}/admin/vendors/{test_vendor_id}",
            json=payload,
            cookies=session_cookies,
            timeout=10
        )
        print_info(f"Status: {response.status_code}")
        print_info(f"Response: {response.text}")
        
        if response.status_code == 400:
            print_success("Correctly returned 400 for invalid status")
            return True
        else:
            print_failure(f"Expected 400, got {response.status_code}")
            return False
    except Exception as e:
        print_failure(f"Exception: {str(e)}")
        return False

# Test 7: Create or use existing lead
def test_create_lead():
    global test_lead_id
    print_test("7. POST /api/leads - Create test lead for vendor assignment")
    
    payload = {
        "name": "Amit Sharma",
        "phone": "9123456789",
        "location": "Bandra West, Mumbai",
        "bhk": "3BHK",
        "area": 1500,
        "service": "interior-painting",
        "paintQuality": "premium",
        "projectType": "repaint",
        "propertyType": "apartment"
    }
    
    try:
        response = requests.post(f"{BASE_URL}/leads", json=payload, timeout=10)
        print_info(f"Status: {response.status_code}")
        print_info(f"Response: {response.text[:500]}...")
        
        if response.status_code == 201:
            data = response.json()
            lead = data.get('lead', {})
            test_lead_id = lead.get('id')
            print_success(f"Lead created with ID: {test_lead_id}")
            return True
        else:
            print_failure(f"Expected 201, got {response.status_code}")
            return False
    except Exception as e:
        print_failure(f"Exception: {str(e)}")
        return False

# Test 8: Assign vendor to lead
def test_assign_vendor_to_lead():
    print_test("8. PUT /api/admin/leads/:id - Assign approved vendor to lead")
    
    try:
        payload = {
            "assignedVendor": "Rajesh Painting Contractors",
            "status": "scheduled"
        }
        
        response = requests.put(
            f"{BASE_URL}/admin/leads/{test_lead_id}",
            json=payload,
            cookies=session_cookies,
            timeout=10
        )
        print_info(f"Status: {response.status_code}")
        print_info(f"Response: {response.text}")
        
        if response.status_code == 200:
            data = response.json()
            lead = data.get('lead', {})
            
            checks = [
                (lead.get('assignedVendor') == payload['assignedVendor'], "AssignedVendor updated"),
                (lead.get('status') == payload['status'], "Status updated to 'scheduled'"),
                (lead.get('id') == test_lead_id, "Lead ID matches"),
            ]
            
            all_passed = True
            for check, description in checks:
                if check:
                    print_success(description)
                else:
                    print_failure(description)
                    all_passed = False
            
            return all_passed
        else:
            print_failure(f"Expected 200, got {response.status_code}")
            return False
    except Exception as e:
        print_failure(f"Exception: {str(e)}")
        return False

# Test 9: Verify GET /api/admin/leads shows assignedVendor
def test_verify_lead_assignment():
    print_test("9. GET /api/admin/leads - Verify assignedVendor is shown")
    
    try:
        response = requests.get(
            f"{BASE_URL}/admin/leads",
            cookies=session_cookies,
            timeout=10
        )
        print_info(f"Status: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            leads = data.get('leads', [])
            
            # Find our test lead
            test_lead = None
            for lead in leads:
                if lead.get('id') == test_lead_id:
                    test_lead = lead
                    break
            
            if test_lead:
                assigned_vendor = test_lead.get('assignedVendor')
                if assigned_vendor == "Rajesh Painting Contractors":
                    print_success(f"Lead shows assignedVendor: {assigned_vendor}")
                    return True
                else:
                    print_failure(f"Expected assignedVendor 'Rajesh Painting Contractors', got '{assigned_vendor}'")
                    return False
            else:
                print_failure(f"Test lead with id {test_lead_id} not found")
                return False
        else:
            print_failure(f"Expected 200, got {response.status_code}")
            return False
    except Exception as e:
        print_failure(f"Exception: {str(e)}")
        return False

# Test 10: Status filter - GET /api/admin/vendors?status=approved
def test_vendor_status_filter():
    print_test("10. GET /api/admin/vendors?status=approved - Filter by status")
    
    try:
        response = requests.get(
            f"{BASE_URL}/admin/vendors?status=approved",
            cookies=session_cookies,
            timeout=10
        )
        print_info(f"Status: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            vendors = data.get('vendors', [])
            
            print_info(f"Total approved vendors: {len(vendors)}")
            
            # Verify all returned vendors have status 'approved'
            all_approved = all(v.get('status') == 'approved' for v in vendors)
            
            # Find our test vendor
            test_vendor_found = any(v.get('id') == test_vendor_id for v in vendors)
            
            if all_approved:
                print_success("All returned vendors have status 'approved'")
            else:
                print_failure("Some vendors do not have status 'approved'")
            
            if test_vendor_found:
                print_success("Test vendor found in approved list")
            else:
                print_failure("Test vendor not found in approved list")
            
            return all_approved and test_vendor_found
        else:
            print_failure(f"Expected 200, got {response.status_code}")
            return False
    except Exception as e:
        print_failure(f"Exception: {str(e)}")
        return False

# Test 11: Logout
def test_logout():
    print_test("11. POST /api/auth/logout - Verify logout works")
    
    try:
        response = requests.post(
            f"{BASE_URL}/auth/logout",
            cookies=session_cookies,
            timeout=10
        )
        print_info(f"Status: {response.status_code}")
        print_info(f"Response: {response.text}")
        
        if response.status_code == 200:
            # Clear session cookies
            session_cookies.clear()
            
            # Verify we can't access protected endpoint anymore
            verify_response = requests.get(
                f"{BASE_URL}/admin/vendors",
                timeout=10
            )
            
            if verify_response.status_code == 401:
                print_success("Logout successful - protected endpoint returns 401")
                return True
            else:
                print_failure(f"After logout, expected 401 for protected endpoint, got {verify_response.status_code}")
                return False
        else:
            print_failure(f"Expected 200, got {response.status_code}")
            return False
    except Exception as e:
        print_failure(f"Exception: {str(e)}")
        return False

# Main test runner
def run_all_tests():
    print("\n" + "="*80)
    print("VENDOR REGISTRATION AND ADMIN APPROVAL API - BACKEND TESTING")
    print("="*80)
    print(f"Base URL: {BASE_URL}")
    print(f"Admin Email: {ADMIN_CREDENTIALS['email']}")
    print(f"Test Started: {datetime.now().isoformat()}")
    
    tests = [
        ("Negative vendor creation", test_vendor_creation_missing_fields),
        ("Positive vendor creation", test_vendor_creation_success),
        ("Unauthenticated admin/vendors", test_admin_vendors_unauthenticated),
        ("Admin login", test_admin_login),
        ("Authenticated admin/vendors", test_admin_vendors_authenticated),
        ("Update vendor to contacted", test_update_vendor_status_contacted),
        ("Update vendor to approved", test_update_vendor_status_approved),
        ("Invalid vendor status", test_update_vendor_invalid_status),
        ("Create test lead", test_create_lead),
        ("Assign vendor to lead", test_assign_vendor_to_lead),
        ("Verify lead assignment", test_verify_lead_assignment),
        ("Vendor status filter", test_vendor_status_filter),
        ("Logout", test_logout),
    ]
    
    results = []
    for test_name, test_func in tests:
        try:
            result = test_func()
            results.append((test_name, result))
        except Exception as e:
            print_failure(f"Test '{test_name}' crashed: {str(e)}")
            results.append((test_name, False))
    
    # Summary
    print("\n" + "="*80)
    print("TEST SUMMARY")
    print("="*80)
    
    passed = sum(1 for _, result in results if result)
    total = len(results)
    
    for test_name, result in results:
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"{status}: {test_name}")
    
    print("\n" + "="*80)
    print(f"TOTAL: {passed}/{total} tests passed")
    print(f"Test Completed: {datetime.now().isoformat()}")
    print("="*80)
    
    return passed == total

if __name__ == "__main__":
    success = run_all_tests()
    sys.exit(0 if success else 1)
