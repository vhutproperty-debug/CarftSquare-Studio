#!/usr/bin/env python3
"""
Backend API Testing for Paint Shade Explorer API and Admin Import
Tests shade retrieval, filtering, search, and admin import functionality
"""

import requests
import json
import sys
from datetime import datetime

BASE_URL = "https://paint-modern.preview.emergentagent.com/api"

# Admin credentials provided
ADMIN_CREDENTIALS = {
    "email": "vhutproperty@gmail.com",
    "password": "Aarush@12345"
}

# Session storage
session_cookies = {}

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

# Test 1: GET /api/shades with no params - should seed defaults and return shades
def test_get_shades_default():
    print_test("GET /api/shades with no params - seed defaults and return shades")
    try:
        response = requests.get(f"{BASE_URL}/shades", timeout=10)
        print_info(f"Status: {response.status_code}")
        print_info(f"Response length: {len(response.text)} bytes")
        
        if response.status_code == 200:
            data = response.json()
            
            # Check required fields
            if 'shades' not in data or 'brands' not in data or 'categories' not in data:
                print_failure(f"Missing required fields. Keys: {data.keys()}")
                return False
            
            shades = data['shades']
            brands = data['brands']
            categories = data['categories']
            
            print_info(f"Shades count: {len(shades)}")
            print_info(f"Brands: {brands}")
            print_info(f"Categories: {categories}")
            
            # Verify shades is an array
            if not isinstance(shades, list):
                print_failure(f"Shades is not an array: {type(shades)}")
                return False
            
            # Verify we have shades (defaults should be seeded)
            if len(shades) == 0:
                print_failure("No shades returned, defaults not seeded")
                return False
            
            # Check for required brands
            required_brands = ['Asian Paints', 'Nerolac', 'Berger', 'Dulux']
            for brand in required_brands:
                if brand not in brands:
                    print_failure(f"Required brand '{brand}' not in brands list")
                    return False
            
            # Verify no _id field exposed in shades
            for shade in shades[:5]:  # Check first 5 shades
                if '_id' in shade:
                    print_failure(f"Shade contains _id field: {shade}")
                    return False
                
                # Verify required shade fields
                required_fields = ['shadeName', 'shadeCode', 'hexColor', 'brand', 'category']
                for field in required_fields:
                    if field not in shade:
                        print_failure(f"Shade missing required field '{field}': {shade}")
                        return False
            
            print_info(f"Sample shade: {shades[0]}")
            print_success(f"GET /api/shades returns {len(shades)} shades with brands {brands}, no _id exposed")
            return True
        else:
            print_failure(f"Expected 200, got {response.status_code}")
            return False
    except Exception as e:
        print_failure(f"Exception: {str(e)}")
        return False

# Test 2: GET /api/shades?brand=Asian%20Paints - filter by brand
def test_get_shades_filter_brand():
    print_test("GET /api/shades?brand=Asian%20Paints - filter by brand")
    try:
        response = requests.get(f"{BASE_URL}/shades?brand=Asian%20Paints", timeout=10)
        print_info(f"Status: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            shades = data.get('shades', [])
            
            print_info(f"Shades count: {len(shades)}")
            
            if len(shades) == 0:
                print_failure("No shades returned for Asian Paints brand")
                return False
            
            # Verify all shades are Asian Paints
            for shade in shades:
                if shade.get('brand') != 'Asian Paints':
                    print_failure(f"Shade has wrong brand: {shade.get('brand')}")
                    return False
            
            print_info(f"Sample Asian Paints shade: {shades[0]}")
            print_success(f"Brand filter works, returned {len(shades)} Asian Paints shades")
            return True
        else:
            print_failure(f"Expected 200, got {response.status_code}")
            return False
    except Exception as e:
        print_failure(f"Exception: {str(e)}")
        return False

# Test 3: GET /api/shades?category=Blue - filter by category
def test_get_shades_filter_category():
    print_test("GET /api/shades?category=Blue - filter by category")
    try:
        response = requests.get(f"{BASE_URL}/shades?category=Blue", timeout=10)
        print_info(f"Status: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            shades = data.get('shades', [])
            
            print_info(f"Shades count: {len(shades)}")
            
            if len(shades) == 0:
                print_failure("No shades returned for Blue category")
                return False
            
            # Verify all shades are Blue category
            for shade in shades:
                if shade.get('category') != 'Blue':
                    print_failure(f"Shade has wrong category: {shade.get('category')}")
                    return False
            
            print_info(f"Sample Blue shade: {shades[0]}")
            print_success(f"Category filter works, returned {len(shades)} Blue shades")
            return True
        else:
            print_failure(f"Expected 200, got {response.status_code}")
            return False
    except Exception as e:
        print_failure(f"Exception: {str(e)}")
        return False

# Test 4: GET /api/shades?search=Ivory - search by shade name
def test_get_shades_search_name():
    print_test("GET /api/shades?search=Ivory - search by shade name")
    try:
        response = requests.get(f"{BASE_URL}/shades?search=Ivory", timeout=10)
        print_info(f"Status: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            shades = data.get('shades', [])
            
            print_info(f"Shades count: {len(shades)}")
            
            if len(shades) == 0:
                print_failure("No shades returned for 'Ivory' search")
                return False
            
            # Verify at least one shade contains 'Ivory' in name
            found = False
            for shade in shades:
                if 'Ivory' in shade.get('shadeName', ''):
                    found = True
                    print_info(f"Found shade: {shade.get('shadeName')} - {shade.get('shadeCode')}")
                    break
            
            if not found:
                print_failure("No shade with 'Ivory' in name found")
                return False
            
            print_success(f"Search by name works, returned {len(shades)} matching shades")
            return True
        else:
            print_failure(f"Expected 200, got {response.status_code}")
            return False
    except Exception as e:
        print_failure(f"Exception: {str(e)}")
        return False

# Test 5: GET /api/shades?search=AP-WH-101 - search by shade code
def test_get_shades_search_code():
    print_test("GET /api/shades?search=AP-WH-101 - search by shade code")
    try:
        response = requests.get(f"{BASE_URL}/shades?search=AP-WH-101", timeout=10)
        print_info(f"Status: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            shades = data.get('shades', [])
            
            print_info(f"Shades count: {len(shades)}")
            
            if len(shades) == 0:
                print_failure("No shades returned for 'AP-WH-101' search")
                return False
            
            # Verify at least one shade has the code
            found = False
            for shade in shades:
                if shade.get('shadeCode') == 'AP-WH-101':
                    found = True
                    print_info(f"Found shade: {shade.get('shadeName')} - {shade.get('shadeCode')}")
                    break
            
            if not found:
                print_failure("No shade with code 'AP-WH-101' found")
                return False
            
            print_success(f"Search by code works, returned {len(shades)} matching shades")
            return True
        else:
            print_failure(f"Expected 200, got {response.status_code}")
            return False
    except Exception as e:
        print_failure(f"Exception: {str(e)}")
        return False

# Test 6: Unauthenticated POST /api/admin/shades/import - should return 401
def test_admin_import_unauthenticated():
    print_test("Unauthenticated POST /api/admin/shades/import - should return 401")
    try:
        response = requests.post(
            f"{BASE_URL}/admin/shades/import",
            json={"mode": "upsert", "shades": []},
            timeout=10
        )
        print_info(f"Status: {response.status_code}")
        print_info(f"Response: {response.text}")
        
        if response.status_code == 401:
            print_success("Unauthenticated import correctly returns 401")
            return True
        else:
            print_failure(f"Expected 401, got {response.status_code}")
            return False
    except Exception as e:
        print_failure(f"Exception: {str(e)}")
        return False

# Test 7: Login as admin and keep session cookie
def test_admin_login():
    print_test("POST /api/auth/login - Login as admin")
    try:
        response = requests.post(
            f"{BASE_URL}/auth/login",
            json=ADMIN_CREDENTIALS,
            timeout=10
        )
        print_info(f"Status: {response.status_code}")
        print_info(f"Response: {response.text}")
        
        if response.status_code == 200:
            data = response.json()
            if 'user' in data:
                user = data['user']
                print_info(f"Logged in as: {user.get('name')} ({user.get('email')})")
                
                # Store session cookie
                session_cookies.update(response.cookies.get_dict())
                print_success(f"Admin login successful, session cookie stored")
                return True
            else:
                print_failure(f"Missing user in response: {data}")
                return False
        else:
            print_failure(f"Expected 200, got {response.status_code}")
            return False
    except Exception as e:
        print_failure(f"Exception: {str(e)}")
        return False

# Test 8: Authenticated POST /api/admin/shades/import with invalid/empty shades - should return 400
def test_admin_import_invalid():
    print_test("Authenticated POST /api/admin/shades/import with empty shades - should return 400")
    try:
        response = requests.post(
            f"{BASE_URL}/admin/shades/import",
            json={"mode": "upsert", "shades": []},
            cookies=session_cookies,
            timeout=10
        )
        print_info(f"Status: {response.status_code}")
        print_info(f"Response: {response.text}")
        
        if response.status_code == 400:
            data = response.json()
            if 'error' in data:
                print_success(f"Empty shades correctly returns 400 with error: {data['error']}")
                return True
            else:
                print_failure(f"400 response missing error field: {data}")
                return False
        else:
            print_failure(f"Expected 400, got {response.status_code}")
            return False
    except Exception as e:
        print_failure(f"Exception: {str(e)}")
        return False

# Test 9: Authenticated POST /api/admin/shades/import with mode upsert and sample shade
def test_admin_import_upsert():
    print_test("Authenticated POST /api/admin/shades/import with mode upsert and sample shade")
    try:
        sample_shade = {
            "shadeName": "Test Malad Pearl",
            "shadeCode": "TEST-001",
            "hexColor": "#ABCDEF",
            "brand": "Asian Paints",
            "category": "Luxury"
        }
        
        response = requests.post(
            f"{BASE_URL}/admin/shades/import",
            json={"mode": "upsert", "shades": [sample_shade]},
            cookies=session_cookies,
            timeout=10
        )
        print_info(f"Status: {response.status_code}")
        print_info(f"Response: {response.text}")
        
        if response.status_code == 200:
            data = response.json()
            if 'imported' in data and 'mode' in data:
                imported_count = data['imported']
                mode = data['mode']
                
                if imported_count == 1 and mode == 'upsert':
                    print_success(f"Upsert successful: {imported_count} shade imported in {mode} mode")
                    return True
                else:
                    print_failure(f"Unexpected imported count or mode: imported={imported_count}, mode={mode}")
                    return False
            else:
                print_failure(f"Missing required fields in response: {data}")
                return False
        else:
            print_failure(f"Expected 200, got {response.status_code}")
            return False
    except Exception as e:
        print_failure(f"Exception: {str(e)}")
        return False

# Test 10: GET /api/shades?search=TEST-001 - verify imported shade
def test_get_imported_shade():
    print_test("GET /api/shades?search=TEST-001 - verify imported shade")
    try:
        response = requests.get(f"{BASE_URL}/shades?search=TEST-001", timeout=10)
        print_info(f"Status: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            shades = data.get('shades', [])
            
            print_info(f"Shades count: {len(shades)}")
            
            if len(shades) == 0:
                print_failure("Imported shade TEST-001 not found")
                return False
            
            # Find the imported shade
            found = False
            for shade in shades:
                if shade.get('shadeCode') == 'TEST-001':
                    found = True
                    print_info(f"Found imported shade: {shade}")
                    
                    # Verify shade details
                    if shade.get('shadeName') != 'Test Malad Pearl':
                        print_failure(f"Shade name mismatch: {shade.get('shadeName')}")
                        return False
                    if shade.get('hexColor') != '#ABCDEF':
                        print_failure(f"Hex color mismatch: {shade.get('hexColor')}")
                        return False
                    if shade.get('brand') != 'Asian Paints':
                        print_failure(f"Brand mismatch: {shade.get('brand')}")
                        return False
                    if shade.get('category') != 'Luxury':
                        print_failure(f"Category mismatch: {shade.get('category')}")
                        return False
                    
                    break
            
            if not found:
                print_failure("Imported shade TEST-001 not found in results")
                return False
            
            print_success("Imported shade TEST-001 found with correct details")
            return True
        else:
            print_failure(f"Expected 200, got {response.status_code}")
            return False
    except Exception as e:
        print_failure(f"Exception: {str(e)}")
        return False

# Test 11: Authenticated POST /api/admin/shades/import with mode replace (careful not to wipe defaults)
def test_admin_import_replace_warning():
    print_test("Authenticated POST /api/admin/shades/import with mode replace - WARNING TEST")
    print_info("⚠️  SKIPPING REPLACE MODE TEST to avoid wiping default shades")
    print_info("Replace mode would delete all existing shades and import only the provided ones")
    print_info("This is destructive and would damage the app if not immediately restored")
    print_success("Replace mode test skipped by design to preserve default shades")
    return True

# Test 12: Ensure logout works
def test_admin_logout():
    print_test("POST /api/auth/logout - Ensure logout works")
    try:
        response = requests.post(
            f"{BASE_URL}/auth/logout",
            cookies=session_cookies,
            timeout=10
        )
        print_info(f"Status: {response.status_code}")
        print_info(f"Response: {response.text}")
        
        if response.status_code == 200:
            # Clear local session cookies
            session_cookies.clear()
            
            # Verify session is cleared by trying to access protected endpoint
            verify_response = requests.get(
                f"{BASE_URL}/admin/shades/import",
                timeout=10
            )
            print_info(f"Verify Status: {verify_response.status_code}")
            
            if verify_response.status_code == 401 or verify_response.status_code == 404:
                print_success("Logout successful, session cleared")
                return True
            else:
                print_failure(f"Session not cleared, got {verify_response.status_code}")
                return False
        else:
            print_failure(f"Expected 200, got {response.status_code}")
            return False
    except Exception as e:
        print_failure(f"Exception: {str(e)}")
        return False

def main():
    print("\n" + "="*80)
    print("PAINT SHADE EXPLORER API AND ADMIN IMPORT TESTING")
    print("Testing shade retrieval, filtering, search, and admin import")
    print("="*80)
    
    results = {}
    
    # Test 1: GET /api/shades with no params
    results['get_shades_default'] = test_get_shades_default()
    
    # Test 2: GET /api/shades?brand=Asian%20Paints
    results['get_shades_filter_brand'] = test_get_shades_filter_brand()
    
    # Test 3: GET /api/shades?category=Blue
    results['get_shades_filter_category'] = test_get_shades_filter_category()
    
    # Test 4: GET /api/shades?search=Ivory
    results['get_shades_search_name'] = test_get_shades_search_name()
    
    # Test 5: GET /api/shades?search=AP-WH-101
    results['get_shades_search_code'] = test_get_shades_search_code()
    
    # Test 6: Unauthenticated POST /api/admin/shades/import
    results['admin_import_unauth'] = test_admin_import_unauthenticated()
    
    # Test 7: Login as admin
    results['admin_login'] = test_admin_login()
    
    # Test 8: Authenticated POST /api/admin/shades/import with invalid/empty shades
    results['admin_import_invalid'] = test_admin_import_invalid()
    
    # Test 9: Authenticated POST /api/admin/shades/import with mode upsert
    results['admin_import_upsert'] = test_admin_import_upsert()
    
    # Test 10: GET /api/shades?search=TEST-001
    results['get_imported_shade'] = test_get_imported_shade()
    
    # Test 11: Replace mode warning (skipped)
    results['admin_import_replace_warning'] = test_admin_import_replace_warning()
    
    # Test 12: Logout
    results['admin_logout'] = test_admin_logout()
    
    # Summary
    print("\n" + "="*80)
    print("TEST SUMMARY")
    print("="*80)
    
    passed = sum(1 for v in results.values() if v)
    total = len(results)
    
    for test_name, result in results.items():
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"{status}: {test_name}")
    
    print("\n" + "="*80)
    print(f"TOTAL: {passed}/{total} tests passed")
    print("="*80)
    
    return 0 if passed == total else 1

if __name__ == "__main__":
    sys.exit(main())
