#!/usr/bin/env python3
"""
Backend API Testing for Admin Identity Update and Password Reset
Tests the new admin credentials (Arun Pandey / vhutproperty@gmail.com) and password reset endpoint
"""

import requests
import json
import sys

BASE_URL = "https://paint-modern.preview.emergentagent.com/api"

# Real admin credentials set by user
ADMIN_CREDENTIALS = {
    "email": "vhutproperty@gmail.com",
    "password": "Aarush@12345",
    "expected_name": "Arun Pandey"
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

# Test 1: POST /api/auth/login with real admin credentials
def test_login_with_real_admin():
    print_test("POST /api/auth/login with vhutproperty@gmail.com / Aarush@12345")
    try:
        response = requests.post(
            f"{BASE_URL}/auth/login",
            json={
                "email": ADMIN_CREDENTIALS["email"],
                "password": ADMIN_CREDENTIALS["password"]
            },
            timeout=10
        )
        print_info(f"Status: {response.status_code}")
        print_info(f"Response: {response.text}")
        
        if response.status_code == 200:
            data = response.json()
            if 'user' in data:
                user = data['user']
                # Verify no sensitive fields
                if 'passwordHash' in user or '_id' in user:
                    print_failure(f"Response contains sensitive fields: passwordHash={('passwordHash' in user)}, _id={('_id' in user)}")
                    return False
                
                # Verify user identity
                if user.get('name') == ADMIN_CREDENTIALS['expected_name'] and user.get('email') == ADMIN_CREDENTIALS['email']:
                    # Store session cookie
                    session_cookies.update(response.cookies.get_dict())
                    print_success(f"Login successful with name='{user.get('name')}', email='{user.get('email')}', session cookie set, no passwordHash/_id in response")
                    return True
                else:
                    print_failure(f"User identity mismatch. Expected name='{ADMIN_CREDENTIALS['expected_name']}', email='{ADMIN_CREDENTIALS['email']}', got name='{user.get('name')}', email='{user.get('email')}'")
                    return False
            else:
                print_failure(f"Missing user in response: {data}")
                return False
        else:
            print_failure(f"Expected 200, got {response.status_code}")
            return False
    except Exception as e:
        print_failure(f"Exception: {str(e)}")
        return False

# Test 2: GET /api/auth/status with session
def test_auth_status_with_session():
    print_test("GET /api/auth/status with session")
    try:
        response = requests.get(
            f"{BASE_URL}/auth/status",
            cookies=session_cookies,
            timeout=10
        )
        print_info(f"Status: {response.status_code}")
        print_info(f"Response: {response.text}")
        
        if response.status_code == 200:
            data = response.json()
            if data.get('authenticated') == True and 'user' in data:
                user = data['user']
                if user.get('name') == ADMIN_CREDENTIALS['expected_name'] and user.get('email') == ADMIN_CREDENTIALS['email']:
                    print_success(f"Auth status returns authenticated=true with correct user identity: name='{user.get('name')}', email='{user.get('email')}'")
                    return True
                else:
                    print_failure(f"User identity mismatch in auth status. Expected name='{ADMIN_CREDENTIALS['expected_name']}', email='{ADMIN_CREDENTIALS['email']}', got name='{user.get('name')}', email='{user.get('email')}'")
                    return False
            else:
                print_failure(f"Expected authenticated=true with user, got: {data}")
                return False
        else:
            print_failure(f"Expected 200, got {response.status_code}")
            return False
    except Exception as e:
        print_failure(f"Exception: {str(e)}")
        return False

# Test 3: POST /api/auth/reset-password without session
def test_reset_password_without_session():
    print_test("POST /api/auth/reset-password without session (should return 401)")
    try:
        response = requests.post(
            f"{BASE_URL}/auth/reset-password",
            json={"password": "NewPassword123!"},
            timeout=10
        )
        print_info(f"Status: {response.status_code}")
        print_info(f"Response: {response.text}")
        
        if response.status_code == 401:
            print_success("Reset password without session correctly returns 401")
            return True
        else:
            print_failure(f"Expected 401, got {response.status_code}")
            return False
    except Exception as e:
        print_failure(f"Exception: {str(e)}")
        return False

# Test 4: POST /api/auth/reset-password with short password while authenticated
def test_reset_password_short_password():
    print_test("POST /api/auth/reset-password with short password (should return 400)")
    try:
        response = requests.post(
            f"{BASE_URL}/auth/reset-password",
            json={"password": "short"},
            cookies=session_cookies,
            timeout=10
        )
        print_info(f"Status: {response.status_code}")
        print_info(f"Response: {response.text}")
        
        if response.status_code == 400:
            data = response.json()
            if 'error' in data:
                print_success(f"Reset password with short password correctly returns 400 with error: {data['error']}")
                return True
            else:
                print_failure(f"Expected error message in response, got: {data}")
                return False
        else:
            print_failure(f"Expected 400, got {response.status_code}")
            return False
    except Exception as e:
        print_failure(f"Exception: {str(e)}")
        return False

# Test 5: POST /api/auth/reset-password with same password (keeps password unchanged)
def test_reset_password_same_password():
    print_test("POST /api/auth/reset-password with Aarush@12345 (keeps password unchanged)")
    try:
        response = requests.post(
            f"{BASE_URL}/auth/reset-password",
            json={"password": ADMIN_CREDENTIALS["password"]},
            cookies=session_cookies,
            timeout=10
        )
        print_info(f"Status: {response.status_code}")
        print_info(f"Response: {response.text}")
        
        if response.status_code == 200:
            data = response.json()
            if 'message' in data:
                print_success(f"Reset password successful: {data['message']}")
                return True
            else:
                print_failure(f"Expected success message, got: {data}")
                return False
        else:
            print_failure(f"Expected 200, got {response.status_code}")
            return False
    except Exception as e:
        print_failure(f"Exception: {str(e)}")
        return False

# Test 6: POST /api/auth/logout
def test_logout():
    print_test("POST /api/auth/logout")
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
            print_success("Logout successful, session cleared")
            return True
        else:
            print_failure(f"Expected 200, got {response.status_code}")
            return False
    except Exception as e:
        print_failure(f"Exception: {str(e)}")
        return False

# Test 7: Login again with same credentials
def test_login_again():
    print_test("POST /api/auth/login again with vhutproperty@gmail.com / Aarush@12345")
    try:
        response = requests.post(
            f"{BASE_URL}/auth/login",
            json={
                "email": ADMIN_CREDENTIALS["email"],
                "password": ADMIN_CREDENTIALS["password"]
            },
            timeout=10
        )
        print_info(f"Status: {response.status_code}")
        print_info(f"Response: {response.text}")
        
        if response.status_code == 200:
            data = response.json()
            if 'user' in data:
                user = data['user']
                if user.get('name') == ADMIN_CREDENTIALS['expected_name'] and user.get('email') == ADMIN_CREDENTIALS['email']:
                    print_success(f"Re-login successful with same credentials, password unchanged")
                    return True
                else:
                    print_failure(f"User identity mismatch after re-login")
                    return False
            else:
                print_failure(f"Missing user in response: {data}")
                return False
        else:
            print_failure(f"Expected 200, got {response.status_code}")
            return False
    except Exception as e:
        print_failure(f"Exception: {str(e)}")
        return False

def main():
    print("\n" + "="*80)
    print("ADMIN IDENTITY UPDATE AND PASSWORD RESET TESTING")
    print("Testing admin credentials: vhutproperty@gmail.com / Aarush@12345")
    print("Expected name: Arun Pandey")
    print("="*80)
    
    results = {}
    
    # Test 1: Login with real admin credentials
    results['login_real_admin'] = test_login_with_real_admin()
    
    # Test 2: Auth status with session
    results['auth_status_session'] = test_auth_status_with_session()
    
    # Test 3: Reset password without session
    results['reset_password_no_session'] = test_reset_password_without_session()
    
    # Test 4: Reset password with short password
    results['reset_password_short'] = test_reset_password_short_password()
    
    # Test 5: Reset password with same password
    results['reset_password_same'] = test_reset_password_same_password()
    
    # Test 6: Logout
    results['logout'] = test_logout()
    
    # Test 7: Login again
    results['login_again'] = test_login_again()
    
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
        print("\n✅ ALL TESTS PASSED - Admin identity and password reset working correctly")
        print(f"Final admin credentials confirmed: {ADMIN_CREDENTIALS['email']} / {ADMIN_CREDENTIALS['password']}")
    else:
        print(f"\n❌ {total - passed} TEST(S) FAILED")
    
    return 0 if passed == total else 1

if __name__ == "__main__":
    sys.exit(main())
