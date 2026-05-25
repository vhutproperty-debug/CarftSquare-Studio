#!/usr/bin/env python3
"""
Backend API Testing for Brush & Bloom Admin Pricing Settings + Service Management
Tests pricing settings CRUD, service management, and public API integration
"""

import requests
import json
import sys
from datetime import datetime

BASE_URL = "https://paint-modern.preview.emergentagent.com/api"

# Admin credentials provided by user
ADMIN_CREDENTIALS = {
    "email": "vhutproperty@gmail.com",
    "password": "Aarush@12345"
}

# Session storage
session_cookies = {}
original_pricing = None
modified_pricing = None

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

# Test 1: Unauthenticated GET /api/admin/pricing returns 401
def test_pricing_unauthenticated():
    print_test("1. Unauthenticated GET /api/admin/pricing returns 401")
    try:
        response = requests.get(f"{BASE_URL}/admin/pricing", timeout=10)
        print_info(f"Status: {response.status_code}")
        print_info(f"Response: {response.text[:200]}")
        
        if response.status_code == 401:
            print_success("Unauthenticated GET /api/admin/pricing correctly returns 401")
            return True
        else:
            print_failure(f"Expected 401, got {response.status_code}")
            return False
    except Exception as e:
        print_failure(f"Exception: {str(e)}")
        return False

# Test 2: Login with admin credentials and keep session cookie
def test_admin_login():
    print_test("2. Login with admin credentials and keep session cookie")
    try:
        response = requests.post(
            f"{BASE_URL}/auth/login",
            json=ADMIN_CREDENTIALS,
            timeout=10
        )
        print_info(f"Status: {response.status_code}")
        print_info(f"Response: {response.text[:300]}")
        
        if response.status_code == 200:
            data = response.json()
            if 'user' in data:
                # Store session cookie
                session_cookies.update(response.cookies.get_dict())
                print_success(f"Admin logged in: {data['user'].get('email')}, session cookie stored")
                print_info(f"Session cookies: {list(session_cookies.keys())}")
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

# Test 3: Authenticated GET /api/admin/pricing returns pricing object
def test_get_pricing_authenticated():
    global original_pricing
    print_test("3. Authenticated GET /api/admin/pricing returns pricing object")
    try:
        response = requests.get(
            f"{BASE_URL}/admin/pricing",
            cookies=session_cookies,
            timeout=10
        )
        print_info(f"Status: {response.status_code}")
        print_info(f"Response length: {len(response.text)} bytes")
        
        if response.status_code == 200:
            data = response.json()
            if 'pricing' in data:
                pricing = data['pricing']
                original_pricing = pricing
                
                # Verify required fields
                required_fields = ['services', 'qualityMultipliers', 'freshMultiplier', 
                                 'materialPercent', 'laborPercent', 'standardWarranty', 
                                 'waterproofingWarranty', 'repaintSqftPerDay', 'freshSqftPerDay']
                
                missing_fields = [field for field in required_fields if field not in pricing]
                if missing_fields:
                    print_failure(f"Missing required fields: {missing_fields}")
                    return False
                
                # Verify services array
                services = pricing.get('services', [])
                if not isinstance(services, list):
                    print_failure(f"Services is not an array: {type(services)}")
                    return False
                
                if len(services) != 8:
                    print_failure(f"Expected 8 services, got {len(services)}")
                    return False
                
                # Verify service structure
                for service in services:
                    required_service_fields = ['id', 'title', 'price', 'description', 'active', 'baseRate']
                    missing = [field for field in required_service_fields if field not in service]
                    if missing:
                        print_failure(f"Service {service.get('id')} missing fields: {missing}")
                        return False
                
                # Verify quality multipliers
                quality_multipliers = pricing.get('qualityMultipliers', {})
                required_qualities = ['economy', 'standard', 'premium', 'luxury']
                missing_qualities = [q for q in required_qualities if q not in quality_multipliers]
                if missing_qualities:
                    print_failure(f"Missing quality multipliers: {missing_qualities}")
                    return False
                
                print_success(f"Pricing object retrieved with {len(services)} services")
                print_info(f"Services: {[s['id'] for s in services]}")
                print_info(f"Quality multipliers: {quality_multipliers}")
                print_info(f"Material %: {pricing.get('materialPercent')}, Labor %: {pricing.get('laborPercent')}")
                print_info(f"Fresh multiplier: {pricing.get('freshMultiplier')}")
                return True
            else:
                print_failure(f"Missing pricing in response: {data.keys()}")
                return False
        else:
            print_failure(f"Expected 200, got {response.status_code}")
            return False
    except Exception as e:
        print_failure(f"Exception: {str(e)}")
        return False

# Test 4: POST /api/admin/pricing with changes
def test_save_pricing_changes():
    global modified_pricing
    print_test("4. POST /api/admin/pricing with changes")
    
    if not original_pricing:
        print_failure("No original pricing available")
        return False
    
    try:
        # Create modified pricing
        modified = json.loads(json.dumps(original_pricing))  # Deep copy
        
        # Change interior-painting baseRate, title, price, description
        for service in modified['services']:
            if service['id'] == 'interior-painting':
                service['baseRate'] = 25  # Changed from default 18
                service['title'] = 'Premium Interior Painting'  # Changed title
                service['price'] = '₹25/sq.ft onwards'  # Changed price label
                service['description'] = 'Ultra-premium wall finish with advanced materials'  # Changed description
                print_info(f"Modified interior-painting: baseRate={service['baseRate']}, title={service['title']}")
            
            # Make one service inactive (e.g., wallpaper)
            if service['id'] == 'wallpaper':
                service['active'] = False
                print_info(f"Set wallpaper service to inactive")
        
        # Change quality multiplier
        modified['qualityMultipliers']['premium'] = 1.35  # Changed from default 1.28
        print_info(f"Modified premium quality multiplier to 1.35")
        
        # Change material/labor percentages
        modified['materialPercent'] = 62  # Changed from default 58
        modified['laborPercent'] = 30  # Changed from default 34
        print_info(f"Modified material % to 62, labor % to 30")
        
        # Change warranty text
        modified['standardWarranty'] = '2 year extended workmanship warranty on all painting projects'
        print_info(f"Modified warranty text")
        
        modified_pricing = modified
        
        # Save changes
        response = requests.post(
            f"{BASE_URL}/admin/pricing",
            json={"pricing": modified},
            cookies=session_cookies,
            timeout=10
        )
        print_info(f"Status: {response.status_code}")
        print_info(f"Response: {response.text[:500]}")
        
        if response.status_code == 200:
            data = response.json()
            if 'pricing' in data:
                saved_pricing = data['pricing']
                
                # Verify changes were saved
                interior = next((s for s in saved_pricing['services'] if s['id'] == 'interior-painting'), None)
                if not interior:
                    print_failure("Interior painting service not found in saved pricing")
                    return False
                
                if interior['baseRate'] != 25:
                    print_failure(f"Interior baseRate not saved correctly: {interior['baseRate']}")
                    return False
                
                if interior['title'] != 'Premium Interior Painting':
                    print_failure(f"Interior title not saved correctly: {interior['title']}")
                    return False
                
                wallpaper = next((s for s in saved_pricing['services'] if s['id'] == 'wallpaper'), None)
                if wallpaper and wallpaper.get('active') != False:
                    print_failure(f"Wallpaper active status not saved correctly: {wallpaper.get('active')}")
                    return False
                
                if saved_pricing['qualityMultipliers']['premium'] != 1.35:
                    print_failure(f"Premium multiplier not saved correctly: {saved_pricing['qualityMultipliers']['premium']}")
                    return False
                
                if saved_pricing['materialPercent'] != 62:
                    print_failure(f"Material percent not saved correctly: {saved_pricing['materialPercent']}")
                    return False
                
                if saved_pricing['laborPercent'] != 30:
                    print_failure(f"Labor percent not saved correctly: {saved_pricing['laborPercent']}")
                    return False
                
                print_success("All pricing changes saved successfully")
                return True
            else:
                print_failure(f"Missing pricing in response: {data.keys()}")
                return False
        else:
            print_failure(f"Expected 200, got {response.status_code}")
            return False
    except Exception as e:
        print_failure(f"Exception: {str(e)}")
        return False

# Test 5: GET /api/services public reflects saved changes
def test_public_services_reflect_changes():
    print_test("5. GET /api/services public reflects saved service changes")
    try:
        response = requests.get(f"{BASE_URL}/services", timeout=10)
        print_info(f"Status: {response.status_code}")
        print_info(f"Response: {response.text[:500]}")
        
        if response.status_code == 200:
            data = response.json()
            if 'services' in data:
                services = data['services']
                
                # Verify interior-painting changes are reflected
                interior = next((s for s in services if s['id'] == 'interior-painting'), None)
                if not interior:
                    print_failure("Interior painting service not found in public services")
                    return False
                
                if interior['title'] != 'Premium Interior Painting':
                    print_failure(f"Interior title not reflected in public services: {interior['title']}")
                    return False
                
                if interior['price'] != '₹25/sq.ft onwards':
                    print_failure(f"Interior price not reflected in public services: {interior['price']}")
                    return False
                
                if interior['description'] != 'Ultra-premium wall finish with advanced materials':
                    print_failure(f"Interior description not reflected in public services: {interior['description']}")
                    return False
                
                # Verify inactive service is filtered out
                wallpaper = next((s for s in services if s['id'] == 'wallpaper'), None)
                if wallpaper:
                    print_failure(f"Inactive wallpaper service should be filtered out but found in public services")
                    return False
                
                # Verify baseRate is NOT exposed in public services
                if 'baseRate' in interior:
                    print_failure(f"baseRate should not be exposed in public services")
                    return False
                
                print_success(f"Public services reflect changes correctly, {len(services)} active services (wallpaper filtered)")
                print_info(f"Active services: {[s['id'] for s in services]}")
                return True
            else:
                print_failure(f"Missing services in response: {data.keys()}")
                return False
        else:
            print_failure(f"Expected 200, got {response.status_code}")
            return False
    except Exception as e:
        print_failure(f"Exception: {str(e)}")
        return False

# Test 6: POST /api/calculate reflects changed pricing
def test_calculate_reflects_pricing_changes():
    print_test("6. POST /api/calculate for interior-painting reflects changed pricing")
    try:
        # Test payload for interior painting
        payload = {
            "service": "interior-painting",
            "area": 1000,
            "bhk": "2BHK",
            "paintQuality": "premium",
            "projectType": "repaint",
            "propertyType": "apartment"
        }
        
        response = requests.post(
            f"{BASE_URL}/calculate",
            json=payload,
            timeout=10
        )
        print_info(f"Status: {response.status_code}")
        print_info(f"Response: {response.text[:500]}")
        
        if response.status_code == 200:
            data = response.json()
            if 'estimate' in data:
                estimate = data['estimate']
                
                # Calculate expected values based on modified pricing
                # baseRate = 25 (changed from 18)
                # premium multiplier = 1.35 (changed from 1.28)
                # area = 1000
                # Expected rate = 25 * 1.35 * 1.0 (repaint) * 1.0 (apartment) * 1.0 (2BHK) = 33.75
                # Expected baseCost = 1000 * 33.75 = 33750
                # Expected low = round((33750 * 0.9) / 500) * 500 = 30500
                # Expected high = round((33750 * 1.18) / 500) * 500 = 40000
                # Material = round(40000 * 0.62) = 24800 (62% from modified)
                # Labor = round(40000 * 0.30) = 12000 (30% from modified)
                
                estimate_high = estimate.get('estimateHigh', 0)
                material_estimate = estimate.get('materialEstimate', 0)
                labor_estimate = estimate.get('laborEstimate', 0)
                
                print_info(f"Estimate high: ₹{estimate_high}")
                print_info(f"Material estimate: ₹{material_estimate}")
                print_info(f"Labor estimate: ₹{labor_estimate}")
                print_info(f"Formatted range: {estimate.get('formattedRange')}")
                print_info(f"Warranty: {estimate.get('warranty')}")
                
                # Verify the estimate is higher than default (due to increased baseRate and multiplier)
                # Default would be: 18 * 1.28 * 1000 = 23040 base, high ~27000
                # Modified should be: 25 * 1.35 * 1000 = 33750 base, high ~40000
                if estimate_high < 35000:
                    print_failure(f"Estimate high {estimate_high} is too low, expected ~40000 with modified pricing")
                    return False
                
                # Verify material/labor percentages are applied correctly
                # Material should be ~62% of high estimate
                expected_material_min = estimate_high * 0.60
                expected_material_max = estimate_high * 0.64
                if not (expected_material_min <= material_estimate <= expected_material_max):
                    print_failure(f"Material estimate {material_estimate} not in expected range {expected_material_min}-{expected_material_max} (62% of {estimate_high})")
                    return False
                
                # Labor should be ~30% of high estimate
                expected_labor_min = estimate_high * 0.28
                expected_labor_max = estimate_high * 0.32
                if not (expected_labor_min <= labor_estimate <= expected_labor_max):
                    print_failure(f"Labor estimate {labor_estimate} not in expected range {expected_labor_min}-{expected_labor_max} (30% of {estimate_high})")
                    return False
                
                # Verify warranty text is updated
                if estimate.get('warranty') != '2 year extended workmanship warranty on all painting projects':
                    print_failure(f"Warranty text not updated: {estimate.get('warranty')}")
                    return False
                
                print_success("Calculate API reflects modified pricing correctly (baseRate, multipliers, material/labor %)")
                return True
            else:
                print_failure(f"Missing estimate in response: {data.keys()}")
                return False
        else:
            print_failure(f"Expected 200, got {response.status_code}")
            return False
    except Exception as e:
        print_failure(f"Exception: {str(e)}")
        return False

# Test 7: POST /api/leads uses current pricing settings
def test_leads_uses_current_pricing():
    print_test("7. POST /api/leads without explicit estimate uses current pricing")
    try:
        lead_data = {
            "name": "Priya Sharma",
            "phone": "9876543210",
            "email": "priya.sharma@example.com",
            "location": "Andheri West, Mumbai",
            "service": "interior-painting",
            "bhk": "2BHK",
            "area": 1000,
            "propertyType": "apartment",
            "paintQuality": "premium",
            "projectType": "repaint",
            "notes": "Need quote for living room"
        }
        
        response = requests.post(
            f"{BASE_URL}/leads",
            json=lead_data,
            timeout=10
        )
        print_info(f"Status: {response.status_code}")
        print_info(f"Response: {response.text[:500]}")
        
        if response.status_code == 201:
            data = response.json()
            if 'lead' in data and 'estimate' in data['lead']:
                estimate = data['lead']['estimate']
                estimate_high = estimate.get('estimateHigh', 0)
                material_estimate = estimate.get('materialEstimate', 0)
                labor_estimate = estimate.get('laborEstimate', 0)
                
                print_info(f"Lead estimate high: ₹{estimate_high}")
                print_info(f"Lead material estimate: ₹{material_estimate}")
                print_info(f"Lead labor estimate: ₹{labor_estimate}")
                print_info(f"Lead warranty: {estimate.get('warranty')}")
                
                # Verify estimate uses modified pricing (should be ~40000, not default ~27000)
                if estimate_high < 35000:
                    print_failure(f"Lead estimate {estimate_high} is too low, expected ~40000 with modified pricing")
                    return False
                
                # Verify warranty text
                if estimate.get('warranty') != '2 year extended workmanship warranty on all painting projects':
                    print_failure(f"Lead warranty text not using current pricing: {estimate.get('warranty')}")
                    return False
                
                print_success("Lead creation uses current admin pricing settings correctly")
                return True
            else:
                print_failure(f"Missing lead or estimate in response: {data.keys()}")
                return False
        else:
            print_failure(f"Expected 201, got {response.status_code}")
            return False
    except Exception as e:
        print_failure(f"Exception: {str(e)}")
        return False

# Test 8: POST /api/admin/pricing/reset resets defaults
def test_reset_pricing_defaults():
    print_test("8. POST /api/admin/pricing/reset resets defaults")
    try:
        response = requests.post(
            f"{BASE_URL}/admin/pricing/reset",
            cookies=session_cookies,
            timeout=10
        )
        print_info(f"Status: {response.status_code}")
        print_info(f"Response: {response.text[:500]}")
        
        if response.status_code == 200:
            data = response.json()
            if 'pricing' in data:
                pricing = data['pricing']
                
                # Verify interior-painting is reset to defaults
                interior = next((s for s in pricing['services'] if s['id'] == 'interior-painting'), None)
                if not interior:
                    print_failure("Interior painting service not found after reset")
                    return False
                
                if interior['baseRate'] != 18:
                    print_failure(f"Interior baseRate not reset to default 18: {interior['baseRate']}")
                    return False
                
                if interior['title'] != 'Interior Painting':
                    print_failure(f"Interior title not reset to default: {interior['title']}")
                    return False
                
                # Verify all services are active again
                inactive_services = [s for s in pricing['services'] if s.get('active') == False]
                if inactive_services:
                    print_failure(f"Found inactive services after reset: {[s['id'] for s in inactive_services]}")
                    return False
                
                # Verify quality multipliers reset
                if pricing['qualityMultipliers']['premium'] != 1.28:
                    print_failure(f"Premium multiplier not reset to default 1.28: {pricing['qualityMultipliers']['premium']}")
                    return False
                
                # Verify material/labor percentages reset
                if pricing['materialPercent'] != 58:
                    print_failure(f"Material percent not reset to default 58: {pricing['materialPercent']}")
                    return False
                
                if pricing['laborPercent'] != 34:
                    print_failure(f"Labor percent not reset to default 34: {pricing['laborPercent']}")
                    return False
                
                # Verify warranty text reset
                if pricing['standardWarranty'] != '1 year workmanship warranty on eligible painting projects':
                    print_failure(f"Warranty not reset to default: {pricing['standardWarranty']}")
                    return False
                
                print_success("Pricing reset to defaults successfully")
                return True
            else:
                print_failure(f"Missing pricing in response: {data.keys()}")
                return False
        else:
            print_failure(f"Expected 200, got {response.status_code}")
            return False
    except Exception as e:
        print_failure(f"Exception: {str(e)}")
        return False

# Test 9: After reset, verify public APIs return defaults
def test_public_apis_after_reset():
    print_test("9. After reset, verify public APIs return defaults")
    try:
        # Test GET /api/services
        services_response = requests.get(f"{BASE_URL}/services", timeout=10)
        print_info(f"Services Status: {services_response.status_code}")
        
        if services_response.status_code != 200:
            print_failure(f"Services endpoint failed: {services_response.status_code}")
            return False
        
        services_data = services_response.json()
        services = services_data.get('services', [])
        
        # Verify 8 active services (all should be active after reset)
        if len(services) != 8:
            print_failure(f"Expected 8 active services after reset, got {len(services)}")
            return False
        
        # Verify interior-painting has default values
        interior = next((s for s in services if s['id'] == 'interior-painting'), None)
        if not interior:
            print_failure("Interior painting not found in services after reset")
            return False
        
        if interior['title'] != 'Interior Painting':
            print_failure(f"Interior title not default after reset: {interior['title']}")
            return False
        
        if interior['price'] != '₹12/sq.ft onwards':
            print_failure(f"Interior price not default after reset: {interior['price']}")
            return False
        
        print_info(f"✓ Services endpoint returns 8 active default services")
        
        # Test POST /api/calculate with same payload as before
        calculate_payload = {
            "service": "interior-painting",
            "area": 1000,
            "bhk": "2BHK",
            "paintQuality": "premium",
            "projectType": "repaint",
            "propertyType": "apartment"
        }
        
        calculate_response = requests.post(
            f"{BASE_URL}/calculate",
            json=calculate_payload,
            timeout=10
        )
        print_info(f"Calculate Status: {calculate_response.status_code}")
        
        if calculate_response.status_code != 200:
            print_failure(f"Calculate endpoint failed: {calculate_response.status_code}")
            return False
        
        calculate_data = calculate_response.json()
        estimate = calculate_data.get('estimate', {})
        estimate_high = estimate.get('estimateHigh', 0)
        
        print_info(f"Calculate estimate high after reset: ₹{estimate_high}")
        print_info(f"Calculate warranty after reset: {estimate.get('warranty')}")
        
        # Verify estimate is back to default range (should be ~27000, not ~40000)
        # Default: 18 * 1.28 * 1000 = 23040 base, high ~27000
        if estimate_high > 32000:
            print_failure(f"Estimate high {estimate_high} is too high, expected ~27000 with default pricing")
            return False
        
        if estimate_high < 23000:
            print_failure(f"Estimate high {estimate_high} is too low, expected ~27000 with default pricing")
            return False
        
        # Verify warranty is default
        if estimate.get('warranty') != '1 year workmanship warranty on eligible painting projects':
            print_failure(f"Warranty not default after reset: {estimate.get('warranty')}")
            return False
        
        print_info(f"✓ Calculate endpoint returns default-like estimate (~₹{estimate_high})")
        
        print_success("Public APIs return default values after reset")
        return True
    except Exception as e:
        print_failure(f"Exception: {str(e)}")
        return False

# Test 10: Logout still works
def test_logout_after_pricing_operations():
    print_test("10. Logout still works after pricing operations")
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
            
            # Verify session is cleared by trying to access protected endpoint
            verify_response = requests.get(
                f"{BASE_URL}/admin/pricing",
                timeout=10
            )
            print_info(f"Verify Status: {verify_response.status_code}")
            
            if verify_response.status_code == 401:
                print_success("Logout successful, session cleared")
                return True
            else:
                print_failure(f"Expected 401 after logout, got {verify_response.status_code}")
                return False
        else:
            print_failure(f"Expected 200, got {response.status_code}")
            return False
    except Exception as e:
        print_failure(f"Exception: {str(e)}")
        return False

def main():
    print("\n" + "="*80)
    print("BRUSH & BLOOM ADMIN PRICING SETTINGS + SERVICE MANAGEMENT API TESTING")
    print("Testing pricing CRUD, service management, and public API integration")
    print("="*80)
    
    results = {}
    
    # Test 1: Unauthenticated pricing access
    results['pricing_unauth'] = test_pricing_unauthenticated()
    
    # Test 2: Admin login
    results['admin_login'] = test_admin_login()
    
    # Test 3: Get pricing authenticated
    results['get_pricing_auth'] = test_get_pricing_authenticated()
    
    # Test 4: Save pricing changes
    results['save_pricing_changes'] = test_save_pricing_changes()
    
    # Test 5: Public services reflect changes
    results['public_services_changes'] = test_public_services_reflect_changes()
    
    # Test 6: Calculate reflects pricing changes
    results['calculate_pricing_changes'] = test_calculate_reflects_pricing_changes()
    
    # Test 7: Leads uses current pricing
    results['leads_current_pricing'] = test_leads_uses_current_pricing()
    
    # Test 8: Reset pricing defaults
    results['reset_pricing'] = test_reset_pricing_defaults()
    
    # Test 9: Public APIs after reset
    results['public_apis_after_reset'] = test_public_apis_after_reset()
    
    # Test 10: Logout
    results['logout'] = test_logout_after_pricing_operations()
    
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
    
    if passed == total:
        print("\n✅ ALL TESTS PASSED - Admin Pricing Settings API is working correctly!")
    else:
        print(f"\n❌ {total - passed} TEST(S) FAILED - Please review failures above")
    
    return 0 if passed == total else 1

if __name__ == "__main__":
    sys.exit(main())
