#!/usr/bin/env python3
"""
Backend smoke tests for Studiebot Next.js LLM routes after code updates
Testing all endpoints for JSON responses with required fields: ok, policy, db_ok
"""

import requests
import json
import sys
from typing import Dict, Any, List

# Base URL for the Next.js server (local)
BASE_URL = "http://localhost:3000"

class StudiebotLLMTester:
    def __init__(self):
        self.results = []
        self.failed_tests = []
        self.exam_id = None
        
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
    
    def validate_json_response(self, response, test_name: str, expected_fields: List[str]) -> bool:
        """Validate that response is JSON with required fields"""
        try:
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
            
            # Check policy field
            if 'policy' in expected_fields and not isinstance(data.get('policy'), dict):
                self.log_result(test_name, False, f"'policy' field should be dict, got: {type(data.get('policy'))}")
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
    
    def test_generate_hints(self):
        """Test 1: POST /api/llm/generate-hints with {"subject":"Geschiedenis","topic":"Landbouwrevolutie","grade":2}"""
        test_name = "Generate Hints"
        url = f"{BASE_URL}/api/llm/generate-hints"
        payload = {
            "subject": "Geschiedenis",
            "topic": "Landbouwrevolutie", 
            "grade": 2
        }
        
        try:
            response = requests.post(url, json=payload, timeout=30)
            
            if response.status_code != 200:
                self.log_result(test_name, False, f"Expected 200, got {response.status_code}")
                return
            
            # Validate JSON structure with required fields
            expected_fields = ['ok', 'policy', 'db_ok']
            if not self.validate_json_response(response, test_name, expected_fields):
                return
            
            data = response.json()
            self.log_result(test_name, True, f"ok={data.get('ok')}, policy={data.get('policy')}, db_ok={data.get('db_ok')}")
            
        except requests.exceptions.RequestException as e:
            self.log_result(test_name, False, f"Request failed: {str(e)}")
        except Exception as e:
            self.log_result(test_name, False, f"Unexpected error: {str(e)}")
    
    def test_quiz_generate_question(self):
        """Test 2: POST /api/llm/quiz/generate-question with {"subject":"Geschiedenis","topic":"Landbouwrevolutie","grade":2}"""
        test_name = "Quiz Generate Question"
        url = f"{BASE_URL}/api/llm/quiz/generate-question"
        payload = {
            "subject": "Geschiedenis",
            "topic": "Landbouwrevolutie",
            "grade": 2
        }
        
        try:
            response = requests.post(url, json=payload, timeout=30)
            
            if response.status_code != 200:
                self.log_result(test_name, False, f"Expected 200, got {response.status_code}")
                return
            
            # Validate JSON structure with required fields
            expected_fields = ['ok', 'policy', 'db_ok']
            if not self.validate_json_response(response, test_name, expected_fields):
                return
            
            data = response.json()
            self.log_result(test_name, True, f"ok={data.get('ok')}, policy={data.get('policy')}, db_ok={data.get('db_ok')}")
            
        except requests.exceptions.RequestException as e:
            self.log_result(test_name, False, f"Request failed: {str(e)}")
        except Exception as e:
            self.log_result(test_name, False, f"Unexpected error: {str(e)}")
    
    def test_grade_quiz(self):
        """Test 3: POST /api/llm/grade-quiz with synthetic single-item payload"""
        test_name = "Grade Quiz"
        url = f"{BASE_URL}/api/llm/grade-quiz"
        payload = {
            "question": {
                "question_id": "Q1",
                "type": "short_answer",
                "stem": "Leg in één zin uit wat akkerbouw is.",
                "choices": [],
                "answer_key": {
                    "correct": [0],
                    "explanation": "Korte modeluitleg."
                },
                "objective": "begrippen",
                "bloom_level": "remember",
                "difficulty": "easy",
                "source_ids": [],
                "hint": None,
                "defined_terms": []
            },
            "student_answer": "Het verbouwen van gewassen op akkers."
        }
        
        try:
            response = requests.post(url, json=payload, timeout=30)
            
            if response.status_code != 200:
                self.log_result(test_name, False, f"Expected 200, got {response.status_code}")
                return
            
            # Validate JSON structure with required fields
            expected_fields = ['ok', 'policy', 'db_ok']
            if not self.validate_json_response(response, test_name, expected_fields):
                return
            
            data = response.json()
            self.log_result(test_name, True, f"ok={data.get('ok')}, policy={data.get('policy')}, db_ok={data.get('db_ok')}")
            
        except requests.exceptions.RequestException as e:
            self.log_result(test_name, False, f"Request failed: {str(e)}")
        except Exception as e:
            self.log_result(test_name, False, f"Unexpected error: {str(e)}")
    
    def test_exam_generate(self):
        """Test 4: POST /api/llm/exam/generate with {"subject":"Geschiedenis","topic":"Landbouwrevolutie","grade":2,"num_items":5}"""
        test_name = "Exam Generate"
        url = f"{BASE_URL}/api/llm/exam/generate"
        payload = {
            "subject": "Geschiedenis",
            "topic": "Landbouwrevolutie",
            "grade": 2,
            "num_items": 5
        }
        
        try:
            response = requests.post(url, json=payload, timeout=30)
            
            if response.status_code != 200:
                self.log_result(test_name, False, f"Expected 200, got {response.status_code}")
                return
            
            # Validate JSON structure with required fields
            expected_fields = ['ok', 'policy', 'db_ok']
            if not self.validate_json_response(response, test_name, expected_fields):
                return
            
            data = response.json()
            
            # Store exam_id for next test if available
            if 'exam_id' in data:
                self.exam_id = data['exam_id']
            
            self.log_result(test_name, True, f"ok={data.get('ok')}, policy={data.get('policy')}, db_ok={data.get('db_ok')}, exam_id={data.get('exam_id')}")
            
        except requests.exceptions.RequestException as e:
            self.log_result(test_name, False, f"Request failed: {str(e)}")
        except Exception as e:
            self.log_result(test_name, False, f"Unexpected error: {str(e)}")
    
    def test_exam_submit(self):
        """Test 5: POST /api/llm/exam/submit using exam_id from step 4 and answering the first qid with a simple string"""
        test_name = "Exam Submit"
        
        # Use exam_id from previous test or a default one
        exam_id = self.exam_id or "test_exam_id"
        
        url = f"{BASE_URL}/api/llm/exam/submit"
        payload = {
            "exam_id": exam_id,
            "answers": [
                {"qid": "Q1", "answer": "De landbouwrevolutie was een periode van verandering in de landbouw."}
            ]
        }
        
        try:
            response = requests.post(url, json=payload, timeout=30)
            
            if response.status_code != 200:
                self.log_result(test_name, False, f"Expected 200, got {response.status_code}")
                return
            
            # Validate JSON structure with required fields
            expected_fields = ['ok', 'policy', 'db_ok']
            if not self.validate_json_response(response, test_name, expected_fields):
                return
            
            data = response.json()
            self.log_result(test_name, True, f"ok={data.get('ok')}, policy={data.get('policy')}, db_ok={data.get('db_ok')}")
            
        except requests.exceptions.RequestException as e:
            self.log_result(test_name, False, f"Request failed: {str(e)}")
        except Exception as e:
            self.log_result(test_name, False, f"Unexpected error: {str(e)}")
    
    def test_invalid_json(self):
        """Test 6: Invalid JSON - should return graceful JSON response (Next.js handles gracefully)"""
        test_name = "Invalid JSON Handling"
        url = f"{BASE_URL}/api/llm/generate-hints"
        
        try:
            # Send invalid JSON
            response = requests.post(url, data="invalid json", headers={'Content-Type': 'application/json'}, timeout=30)
            
            # Next.js handles invalid JSON gracefully with 200 status
            if response.status_code != 200:
                self.log_result(test_name, False, f"Expected 200 (graceful handling), got {response.status_code}")
                return
            
            # Check Content-Type is still JSON
            content_type = response.headers.get('content-type', '')
            if 'application/json' not in content_type:
                self.log_result(test_name, False, f"Response should be JSON, got: {content_type}")
                return
            
            # Check JSON structure - should have required fields
            try:
                data = response.json()
                expected_fields = ['ok', 'policy', 'db_ok']
                if not self.validate_json_response(response, test_name, expected_fields):
                    return
            except json.JSONDecodeError:
                self.log_result(test_name, False, "Response is not valid JSON")
                return
            
            self.log_result(test_name, True, f"Invalid JSON handled gracefully with status {response.status_code}, ok={data.get('ok')}")
            
        except requests.exceptions.RequestException as e:
            self.log_result(test_name, False, f"Request failed: {str(e)}")
        except Exception as e:
            self.log_result(test_name, False, f"Unexpected error: {str(e)}")
    
    def run_all_tests(self):
        """Run all backend tests"""
        print("🚀 Starting Studiebot LLM Backend Smoke Tests")
        print("=" * 60)
        print(f"Testing against: {BASE_URL}")
        print("=" * 60)
        
        # Run tests in order
        self.test_generate_hints()
        self.test_quiz_generate_question()
        self.test_grade_quiz()
        self.test_exam_generate()
        self.test_exam_submit()
        self.test_invalid_json()
        
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
    tester = StudiebotLLMTester()
    success = tester.run_all_tests()
    
    # Exit with appropriate code
    sys.exit(0 if success else 1)

if __name__ == "__main__":
    main()