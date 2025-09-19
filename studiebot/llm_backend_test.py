#!/usr/bin/env python3
"""
Backend smoke tests for Next.js LLM API routes in Studiebot
Testing all endpoints for JSON responses with required fields: ok, policy, db_ok
"""

import requests
import json
import sys
from typing import Dict, Any, List

# Base URL for the Next.js server
BASE_URL = "http://localhost:3000"

class LLMBackendTester:
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
    
    def test_learn_generate_hints(self):
        """Test 1: Learn - POST /api/llm/generate-hints"""
        test_name = "Learn Generate Hints"
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
            
            # Check X-Studiebot-LLM header
            llm_header = response.headers.get('X-Studiebot-LLM')
            if not llm_header:
                self.log_result(test_name, False, "Missing X-Studiebot-LLM header")
                return
            
            # Validate JSON structure
            expected_fields = ['ok', 'tutor_message', 'hints', 'follow_up_question', 'policy', 'db_ok']
            if not self.validate_json_response(response, test_name, expected_fields):
                return
            
            data = response.json()
            
            # Additional field type checks
            if not isinstance(data.get('tutor_message'), str):
                self.log_result(test_name, False, f"tutor_message should be string, got: {type(data.get('tutor_message'))}")
                return
            
            if not isinstance(data.get('hints'), list):
                self.log_result(test_name, False, f"hints should be array, got: {type(data.get('hints'))}")
                return
            
            if not isinstance(data.get('follow_up_question'), str):
                self.log_result(test_name, False, f"follow_up_question should be string, got: {type(data.get('follow_up_question'))}")
                return
            
            self.log_result(test_name, True, f"All fields present, X-Studiebot-LLM: {llm_header}")
            
        except requests.exceptions.RequestException as e:
            self.log_result(test_name, False, f"Request failed: {str(e)}")
        except Exception as e:
            self.log_result(test_name, False, f"Unexpected error: {str(e)}")
    
    def test_quiz_generate_question(self):
        """Test 2: Quiz Generate - POST /api/llm/quiz/generate-question"""
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
            
            # Validate JSON structure
            expected_fields = ['ok', 'question_id', 'type', 'stem', 'bloom_level', 'difficulty', 'hint', 'policy', 'db_ok']
            if not self.validate_json_response(response, test_name, expected_fields):
                return
            
            data = response.json()
            
            # Check hint field is string or null
            hint = data.get('hint')
            if hint is not None and not isinstance(hint, str):
                self.log_result(test_name, False, f"hint should be string or null, got: {type(hint)}")
                return
            
            self.log_result(test_name, True, f"Question generated with ID: {data.get('question_id')}")
            
        except requests.exceptions.RequestException as e:
            self.log_result(test_name, False, f"Request failed: {str(e)}")
        except Exception as e:
            self.log_result(test_name, False, f"Unexpected error: {str(e)}")
    
    def test_grade_quiz_single(self):
        """Test 3: Grade Single - POST /api/llm/grade-quiz"""
        test_name = "Grade Quiz Single"
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
            
            # Validate JSON structure
            expected_fields = ['ok', 'is_correct', 'score', 'feedback', 'weak_areas', 'next_recommended_focus', 'chat_prefill', 'policy', 'db_ok']
            if not self.validate_json_response(response, test_name, expected_fields):
                return
            
            data = response.json()
            
            # Check score is between 0 and 1
            score = data.get('score')
            if not isinstance(score, (int, float)) or score < 0 or score > 1:
                self.log_result(test_name, False, f"score should be number 0..1, got: {score}")
                return
            
            # Check feedback is Dutch string
            feedback = data.get('feedback')
            if not isinstance(feedback, str):
                self.log_result(test_name, False, f"feedback should be string, got: {type(feedback)}")
                return
            
            # Check next_recommended_focus is array with max 3 items
            focus = data.get('next_recommended_focus', [])
            if not isinstance(focus, list) or len(focus) > 3:
                self.log_result(test_name, False, f"next_recommended_focus should be array ≤3 items, got: {len(focus)} items")
                return
            
            self.log_result(test_name, True, f"Score: {score}, Correct: {data.get('is_correct')}")
            
        except requests.exceptions.RequestException as e:
            self.log_result(test_name, False, f"Request failed: {str(e)}")
        except Exception as e:
            self.log_result(test_name, False, f"Unexpected error: {str(e)}")
    
    def test_exam_generate_batch(self):
        """Test 4: Exam Generate Batch - POST /api/llm/exam/generate"""
        test_name = "Exam Generate Batch"
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
            
            # Validate JSON structure
            expected_fields = ['ok', 'exam_id', 'items', 'policy', 'db_ok']
            if not self.validate_json_response(response, test_name, expected_fields):
                return
            
            data = response.json()
            
            # Check items array length
            items = data.get('items', [])
            if not isinstance(items, list) or len(items) != 5:
                self.log_result(test_name, False, f"items should be array of 5, got: {len(items)} items")
                return
            
            # Check each item structure
            for i, item in enumerate(items):
                required_item_fields = ['qid', 'type', 'stem', 'choices', 'answer_key', 'bloom_level', 'difficulty', 'hint', 'defined_terms']
                for field in required_item_fields:
                    if field not in item:
                        self.log_result(test_name, False, f"Item {i} missing field: {field}")
                        return
                
                # Check hint is null
                if item.get('hint') is not None:
                    self.log_result(test_name, False, f"Item {i} hint should be null, got: {item.get('hint')}")
                    return
                
                # Check defined_terms is array
                if not isinstance(item.get('defined_terms'), list):
                    self.log_result(test_name, False, f"Item {i} defined_terms should be array, got: {type(item.get('defined_terms'))}")
                    return
            
            # Store exam_id for next test
            self.exam_id = data.get('exam_id')
            self.log_result(test_name, True, f"Generated exam with ID: {self.exam_id}, {len(items)} items")
            
        except requests.exceptions.RequestException as e:
            self.log_result(test_name, False, f"Request failed: {str(e)}")
        except Exception as e:
            self.log_result(test_name, False, f"Unexpected error: {str(e)}")
    
    def test_exam_submit(self):
        """Test 5: Exam Submit - POST /api/llm/exam/submit"""
        test_name = "Exam Submit"
        
        # Need exam_id from previous test
        if not hasattr(self, 'exam_id') or not self.exam_id:
            self.log_result(test_name, False, "No exam_id available from previous test")
            return
        
        url = f"{BASE_URL}/api/llm/exam/submit"
        payload = {
            "exam_id": self.exam_id,
            "answers": [
                {"qid": "Q1", "answer": "voorbeeld"}
            ]
        }
        
        try:
            response = requests.post(url, json=payload, timeout=30)
            
            if response.status_code != 200:
                self.log_result(test_name, False, f"Expected 200, got {response.status_code}")
                return
            
            # Validate JSON structure
            expected_fields = ['ok', 'score', 'grade', 'summary_line', 'focus_points', 'per_item', 'weak_areas', 'chat_prefill', 'policy', 'db_ok']
            if not self.validate_json_response(response, test_name, expected_fields):
                return
            
            data = response.json()
            
            # Check focus_points max 3
            focus_points = data.get('focus_points', [])
            if not isinstance(focus_points, list) or len(focus_points) > 3:
                self.log_result(test_name, False, f"focus_points should be array ≤3 items, got: {len(focus_points)} items")
                return
            
            # Check per_item is array
            per_item = data.get('per_item', [])
            if not isinstance(per_item, list):
                self.log_result(test_name, False, f"per_item should be array, got: {type(per_item)}")
                return
            
            # Check weak_areas is array
            weak_areas = data.get('weak_areas', [])
            if not isinstance(weak_areas, list):
                self.log_result(test_name, False, f"weak_areas should be array, got: {type(weak_areas)}")
                return
            
            self.log_result(test_name, True, f"Score: {data.get('score')}, Grade: {data.get('grade')}")
            
        except requests.exceptions.RequestException as e:
            self.log_result(test_name, False, f"Request failed: {str(e)}")
        except Exception as e:
            self.log_result(test_name, False, f"Unexpected error: {str(e)}")
    
    def test_invalid_json(self):
        """Test 6: Invalid JSON - should return 400/500 with JSON body containing ok=false"""
        test_name = "Invalid JSON Handling"
        url = f"{BASE_URL}/api/llm/generate-hints"
        
        try:
            # Send invalid JSON
            response = requests.post(url, data="invalid json", headers={'Content-Type': 'application/json'}, timeout=30)
            
            # Should return 400 or 500 but still with JSON
            if response.status_code not in [400, 500]:
                self.log_result(test_name, False, f"Expected 400 or 500, got {response.status_code}")
                return
            
            # Check Content-Type is still JSON
            content_type = response.headers.get('content-type', '')
            if 'application/json' not in content_type:
                self.log_result(test_name, False, f"Error response should be JSON, got: {content_type}")
                return
            
            # Check JSON structure
            try:
                data = response.json()
                if data.get('ok') is not False:
                    self.log_result(test_name, False, f"Error response should have ok=false, got: {data.get('ok')}")
                    return
            except json.JSONDecodeError:
                self.log_result(test_name, False, "Error response is not valid JSON")
                return
            
            self.log_result(test_name, True, f"Invalid JSON handled correctly with status {response.status_code}")
            
        except requests.exceptions.RequestException as e:
            self.log_result(test_name, False, f"Request failed: {str(e)}")
        except Exception as e:
            self.log_result(test_name, False, f"Unexpected error: {str(e)}")
    
    def test_no_empty_body(self):
        """Test 7: Verify no route returns empty body or HTML"""
        test_name = "No Empty/HTML Body"
        urls_to_test = [
            f"{BASE_URL}/api/llm/generate-hints",
            f"{BASE_URL}/api/llm/quiz/generate-question",
            f"{BASE_URL}/api/llm/grade-quiz",
            f"{BASE_URL}/api/llm/exam/generate"
        ]
        
        for url in urls_to_test:
            try:
                # Send empty POST request
                response = requests.post(url, json={}, timeout=30)
                
                # Check response is not empty
                if len(response.content) == 0:
                    self.log_result(test_name, False, f"Empty response from {url}")
                    return
                
                # Check Content-Type is JSON
                content_type = response.headers.get('content-type', '')
                if 'application/json' not in content_type:
                    self.log_result(test_name, False, f"Non-JSON response from {url}: {content_type}")
                    return
                
                # Check it's valid JSON
                try:
                    response.json()
                except json.JSONDecodeError:
                    self.log_result(test_name, False, f"Invalid JSON from {url}")
                    return
                    
            except requests.exceptions.RequestException as e:
                self.log_result(test_name, False, f"Request to {url} failed: {str(e)}")
                return
            except Exception as e:
                self.log_result(test_name, False, f"Unexpected error testing {url}: {str(e)}")
                return
        
        self.log_result(test_name, True, "All routes return valid JSON responses")
    
    def run_all_tests(self):
        """Run all backend tests"""
        print("🚀 Starting LLM Backend Smoke Tests")
        print("=" * 50)
        
        # Initialize exam_id
        self.exam_id = None
        
        # Run tests in order
        self.test_learn_generate_hints()
        self.test_quiz_generate_question()
        self.test_grade_quiz_single()
        self.test_exam_generate_batch()
        self.test_exam_submit()
        self.test_invalid_json()
        self.test_no_empty_body()
        
        # Summary
        print("\n" + "=" * 50)
        print("📊 TEST SUMMARY")
        print("=" * 50)
        
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
    tester = LLMBackendTester()
    success = tester.run_all_tests()
    
    # Exit with appropriate code
    sys.exit(0 if success else 1)

if __name__ == "__main__":
    main()