#!/usr/bin/env python3
"""
Materials Upload Backend Tests
Testing the new upload routes /api/materials/upload and /api/upload
"""

import requests
import json
import sys
import os
from typing import Dict, Any, List

# Base URL for the Next.js server
BASE_URL = "http://localhost:3000"

class MaterialsUploadTester:
    def __init__(self):
        self.results = []
        self.failed_tests = []
        
    def log_result(self, test_name: str, success: bool, details: str = ""):
        """Log test result"""
        status = "✅ PASS" if success else "❌ FAIL"
        result = f"{status}: {test_name}"
        if details:
            result += f" - {details}"
        print(result)
        self.results.append({
            'test': test_name,
            'success': success,
            'details': details
        })
        if not success:
            self.failed_tests.append(test_name)
    
    def validate_json_response(self, response, test_name: str, expected_fields: List[str], expected_status: int = 200) -> bool:
        """Validate that response is JSON with required fields"""
        try:
            # Check status code
            if response.status_code != expected_status:
                self.log_result(test_name, False, f"Expected status {expected_status}, got {response.status_code}")
                return False
            
            # Check Content-Type header
            content_type = response.headers.get('content-type', '')
            if 'application/json' not in content_type:
                self.log_result(test_name, False, f"Wrong Content-Type: {content_type}, expected application/json")
                return False
            
            # Parse JSON
            data = response.json()
            
            # Check required fields
            missing_fields = []
            for field in expected_fields:
                if field not in data:
                    missing_fields.append(field)
            
            if missing_fields:
                self.log_result(test_name, False, f"Missing fields: {missing_fields}")
                return False
            
            # Check ok field specifically
            if 'ok' in expected_fields and not isinstance(data.get('ok'), bool):
                self.log_result(test_name, False, f"'ok' field should be boolean, got: {type(data.get('ok'))}")
                return False
            
            # Check db_ok field
            if 'db_ok' in expected_fields and not isinstance(data.get('db_ok'), bool):
                self.log_result(test_name, False, f"'db_ok' field should be boolean, got: {type(data.get('db_ok'))}")
                return False
            
            return True
            
        except json.JSONDecodeError as e:
            self.log_result(test_name, False, f"Invalid JSON response: {str(e)}")
            return False
        except Exception as e:
            self.log_result(test_name, False, f"Response validation error: {str(e)}")
            return False
    
    def create_test_pdf(self, size_mb: float = 0.001) -> bytes:
        """Create a test PDF of specified size"""
        # Basic PDF content
        pdf_content = b"""%PDF-1.4
1 0 obj
<<
/Type /Catalog
/Pages 2 0 R
>>
endobj
2 0 obj
<<
/Type /Pages
/Kids [3 0 R]
/Count 1
>>
endobj
3 0 obj
<<
/Type /Page
/Parent 2 0 R
/MediaBox [0 0 612 792]
/Contents 4 0 R
>>
endobj
4 0 obj
<<
/Length 44
>>
stream
BT
/F1 12 Tf
72 720 Td
(Test PDF) Tj
ET
endstream
endobj
xref
0 5
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000204 00000 n 
trailer
<<
/Size 5
/Root 1 0 R
>>
startxref
297
%%EOF"""
        
        # Pad to desired size if needed
        target_size = int(size_mb * 1024 * 1024)
        if len(pdf_content) < target_size:
            padding = b' ' * (target_size - len(pdf_content) - 10) + b'\n%%EOF'
            pdf_content = pdf_content[:-5] + padding  # Replace %%EOF with padding + %%EOF
        
        return pdf_content
    
    def test_successful_upload(self):
        """Test 1: Successful multipart upload to /api/materials/upload"""
        test_name = "Successful Upload to /api/materials/upload"
        url = f"{BASE_URL}/api/materials/upload"
        
        # Create test PDF
        pdf_content = self.create_test_pdf(0.001)  # 1KB PDF
        
        files = {
            'file': ('test_document.pdf', pdf_content, 'application/pdf')
        }
        data = {
            'subject': 'Geschiedenis',
            'topic': 'Landbouwrevolutie',
            'grade': '2',
            'chapter': '1'
        }
        
        headers = {
            'Accept': 'application/json'
        }
        
        try:
            response = requests.post(url, files=files, data=data, headers=headers, timeout=30)
            
            # Validate JSON structure with required fields
            expected_fields = ['ok', 'policy', 'db_ok', 'file', 'material', 'storage']
            if not self.validate_json_response(response, test_name, expected_fields, 200):
                return
            
            data = response.json()
            
            # Additional validations
            if not data.get('ok'):
                self.log_result(test_name, False, f"Expected ok=true, got ok={data.get('ok')}")
                return
            
            if not data.get('db_ok'):
                self.log_result(test_name, False, f"Expected db_ok=true, got db_ok={data.get('db_ok')}")
                return
            
            storage = data.get('storage', {})
            if storage.get('driver') != 'gridfs':
                self.log_result(test_name, False, f"Expected storage.driver='gridfs', got {storage.get('driver')}")
                return
            
            self.log_result(test_name, True, f"ok={data.get('ok')}, db_ok={data.get('db_ok')}, storage.driver={storage.get('driver')}")
            
        except requests.exceptions.RequestException as e:
            self.log_result(test_name, False, f"Request failed: {str(e)}")
        except Exception as e:
            self.log_result(test_name, False, f"Unexpected error: {str(e)}")
    
    def test_wrong_content_type(self):
        """Test 2: Wrong Content-Type (application/json) -> 400 JSON ok=false"""
        test_name = "Wrong Content-Type (application/json)"
        url = f"{BASE_URL}/api/materials/upload"
        
        payload = {
            'file': 'fake_file_data',
            'subject': 'Test'
        }
        
        headers = {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        }
        
        try:
            response = requests.post(url, json=payload, headers=headers, timeout=30)
            
            # Should return 400 with JSON error
            expected_fields = ['ok', 'policy', 'db_ok']
            if not self.validate_json_response(response, test_name, expected_fields, 400):
                return
            
            data = response.json()
            
            if data.get('ok') != False:
                self.log_result(test_name, False, f"Expected ok=false, got ok={data.get('ok')}")
                return
            
            if data.get('db_ok') != False:
                self.log_result(test_name, False, f"Expected db_ok=false, got db_ok={data.get('db_ok')}")
                return
            
            self.log_result(test_name, True, f"Correctly returned 400 with ok=false, db_ok=false")
            
        except requests.exceptions.RequestException as e:
            self.log_result(test_name, False, f"Request failed: {str(e)}")
        except Exception as e:
            self.log_result(test_name, False, f"Unexpected error: {str(e)}")
    
    def test_oversize_file(self):
        """Test 3: Oversize file (>15MB) -> 413 JSON ok=false"""
        test_name = "Oversize File (>15MB)"
        url = f"{BASE_URL}/api/materials/upload"
        
        # Create a large PDF (16MB)
        pdf_content = self.create_test_pdf(16)  # 16MB PDF
        
        files = {
            'file': ('large_document.pdf', pdf_content, 'application/pdf')
        }
        data = {
            'subject': 'Test',
            'topic': 'Test'
        }
        
        headers = {
            'Accept': 'application/json'
        }
        
        try:
            response = requests.post(url, files=files, data=data, headers=headers, timeout=60)
            
            # Should return 413 with JSON error
            expected_fields = ['ok', 'policy', 'db_ok']
            if not self.validate_json_response(response, test_name, expected_fields, 413):
                return
            
            data = response.json()
            
            if data.get('ok') != False:
                self.log_result(test_name, False, f"Expected ok=false, got ok={data.get('ok')}")
                return
            
            if data.get('db_ok') != False:
                self.log_result(test_name, False, f"Expected db_ok=false, got db_ok={data.get('db_ok')}")
                return
            
            self.log_result(test_name, True, f"Correctly returned 413 with ok=false, db_ok=false")
            
        except requests.exceptions.RequestException as e:
            self.log_result(test_name, False, f"Request failed: {str(e)}")
        except Exception as e:
            self.log_result(test_name, False, f"Unexpected error: {str(e)}")
    
    def test_alias_route(self):
        """Test 4: Alias route /api/upload works the same"""
        test_name = "Alias Route /api/upload"
        url = f"{BASE_URL}/api/upload"
        
        # Create test PDF
        pdf_content = self.create_test_pdf(0.001)  # 1KB PDF
        
        files = {
            'file': ('test_alias.pdf', pdf_content, 'application/pdf')
        }
        data = {
            'subject': 'Test',
            'topic': 'Test'
        }
        
        headers = {
            'Accept': 'application/json'
        }
        
        try:
            response = requests.post(url, files=files, data=data, headers=headers, timeout=30)
            
            # Should work the same as /api/materials/upload
            expected_fields = ['ok', 'policy', 'db_ok', 'file', 'material', 'storage']
            if not self.validate_json_response(response, test_name, expected_fields, 200):
                return
            
            data = response.json()
            
            if not data.get('ok'):
                self.log_result(test_name, False, f"Expected ok=true, got ok={data.get('ok')}")
                return
            
            if not data.get('db_ok'):
                self.log_result(test_name, False, f"Expected db_ok=true, got db_ok={data.get('db_ok')}")
                return
            
            storage = data.get('storage', {})
            if storage.get('driver') != 'gridfs':
                self.log_result(test_name, False, f"Expected storage.driver='gridfs', got {storage.get('driver')}")
                return
            
            self.log_result(test_name, True, f"Alias route works correctly: ok={data.get('ok')}, db_ok={data.get('db_ok')}")
            
        except requests.exceptions.RequestException as e:
            self.log_result(test_name, False, f"Request failed: {str(e)}")
        except Exception as e:
            self.log_result(test_name, False, f"Unexpected error: {str(e)}")
    
    def test_non_post_method(self):
        """Test 5: Non-POST method returns 405 JSON ok=false"""
        test_name = "Non-POST Method (GET)"
        url = f"{BASE_URL}/api/materials/upload"
        
        headers = {
            'Accept': 'application/json'
        }
        
        try:
            response = requests.get(url, headers=headers, timeout=30)
            
            # Should return 405 with JSON error
            expected_fields = ['ok', 'policy', 'db_ok']
            if not self.validate_json_response(response, test_name, expected_fields, 405):
                return
            
            data = response.json()
            
            if data.get('ok') != False:
                self.log_result(test_name, False, f"Expected ok=false, got ok={data.get('ok')}")
                return
            
            self.log_result(test_name, True, f"Correctly returned 405 with ok=false for GET method")
            
        except requests.exceptions.RequestException as e:
            self.log_result(test_name, False, f"Request failed: {str(e)}")
        except Exception as e:
            self.log_result(test_name, False, f"Unexpected error: {str(e)}")
    
    def run_all_tests(self):
        """Run all upload tests"""
        print("🚀 Starting Materials Upload Backend Tests")
        print("=" * 60)
        print(f"Testing against: {BASE_URL}")
        print("=" * 60)
        
        # Run tests in order
        self.test_successful_upload()
        self.test_wrong_content_type()
        self.test_oversize_file()
        self.test_alias_route()
        self.test_non_post_method()
        
        # Summary
        print("\n" + "=" * 60)
        print("📊 TEST SUMMARY")
        print("=" * 60)
        
        total_tests = len(self.results)
        passed_tests = len([r for r in self.results if r['success']])
        failed_tests = len(self.failed_tests)
        
        print(f"Total Tests: {total_tests}")
        print(f"Passed: {passed_tests}")
        print(f"Failed: {failed_tests}")
        
        if self.failed_tests:
            print(f"\n❌ FAILED TESTS:")
            for test in self.failed_tests:
                print(f"  - {test}")
        else:
            print(f"\n🎉 ALL TESTS PASSED!")
        
        return failed_tests == 0

def main():
    """Main test runner"""
    tester = MaterialsUploadTester()
    success = tester.run_all_tests()
    
    # Exit with appropriate code
    sys.exit(0 if success else 1)

if __name__ == "__main__":
    main()