#!/usr/bin/env python3
"""
Test the refactored Studiebot LLM prompts functionality
Testing the specific endpoints mentioned in the review request
"""

import requests
import json
import sys
import os
from typing import Dict, Any

# Set MongoDB URI
os.environ['MONGODB_URI'] = 'mongodb://localhost:27017'

# Base URL for the Next.js server
BASE_URL = "http://localhost:3000"

class RefactoredLLMTester:
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
    
    def test_quiz_generate_question(self):
        """Test /api/llm/quiz/generate-question endpoint"""
        test_name = "Quiz Generate Question"
        url = f"{BASE_URL}/api/llm/quiz/generate-question"
        payload = {
            "topicId": "test-topic",
            "objective": "test objective",
            "subject": "Geschiedenis",
            "grade": 2,
            "chapter": "test-chapter"
        }
        
        try:
            response = requests.post(url, json=payload, timeout=30)
            print(f"Response status: {response.status_code}")
            print(f"Response headers: {dict(response.headers)}")
            
            if response.status_code == 400:
                # Check if it's a no_material error (expected when no materials are loaded)
                try:
                    data = response.json()
                    if data.get('reason') == 'no_material':
                        self.log_result(test_name, True, f"Expected no_material error: {data.get('message')}")
                        return
                except:
                    pass
            
            if response.status_code != 200:
                try:
                    error_data = response.json()
                    self.log_result(test_name, False, f"Status {response.status_code}: {error_data}")
                except:
                    self.log_result(test_name, False, f"Status {response.status_code}: {response.text}")
                return
            
            # Check debug headers
            debug_header = response.headers.get('X-Debug')
            context_size = response.headers.get('X-Context-Size')
            model_header = response.headers.get('X-Model')
            
            if not debug_header:
                self.log_result(test_name, False, "Missing X-Debug header")
                return
            
            # Validate JSON structure
            try:
                data = response.json()
                required_fields = ['ok', 'question_id', 'type', 'stem', 'policy', 'db_ok']
                missing_fields = [field for field in required_fields if field not in data]
                
                if missing_fields:
                    self.log_result(test_name, False, f"Missing fields: {missing_fields}")
                    return
                
                self.log_result(test_name, True, f"Headers: X-Debug={debug_header}, X-Context-Size={context_size}")
                
            except json.JSONDecodeError as e:
                self.log_result(test_name, False, f"Invalid JSON: {str(e)}")
                return
            
        except requests.exceptions.RequestException as e:
            self.log_result(test_name, False, f"Request failed: {str(e)}")
        except Exception as e:
            self.log_result(test_name, False, f"Unexpected error: {str(e)}")
    
    def test_exam_generate(self):
        """Test /api/llm/exam/generate endpoint"""
        test_name = "Exam Generate"
        url = f"{BASE_URL}/api/llm/exam/generate"
        payload = {
            "topicId": "test-topic",
            "totalQuestions": 5,
            "subject": "Geschiedenis",
            "grade": 2,
            "chapter": "test-chapter"
        }
        
        try:
            response = requests.post(url, json=payload, timeout=30)
            print(f"Response status: {response.status_code}")
            print(f"Response headers: {dict(response.headers)}")
            
            if response.status_code == 400:
                # Check if it's a no_material error (expected when no materials are loaded)
                try:
                    data = response.json()
                    if data.get('reason') == 'no_material':
                        self.log_result(test_name, True, f"Expected no_material error: {data.get('message')}")
                        return
                except:
                    pass
            
            if response.status_code != 200:
                try:
                    error_data = response.json()
                    self.log_result(test_name, False, f"Status {response.status_code}: {error_data}")
                except:
                    self.log_result(test_name, False, f"Status {response.status_code}: {response.text}")
                return
            
            # Check debug headers
            debug_header = response.headers.get('X-Debug')
            context_size = response.headers.get('X-Context-Size')
            
            if not debug_header:
                self.log_result(test_name, False, "Missing X-Debug header")
                return
            
            # Validate JSON structure
            try:
                data = response.json()
                required_fields = ['ok', 'exam_id', 'items', 'policy', 'db_ok']
                missing_fields = [field for field in required_fields if field not in data]
                
                if missing_fields:
                    self.log_result(test_name, False, f"Missing fields: {missing_fields}")
                    return
                
                # Store exam_id for submit test
                self.exam_id = data.get('exam_id')
                self.log_result(test_name, True, f"Generated exam {self.exam_id} with {len(data.get('items', []))} items")
                
            except json.JSONDecodeError as e:
                self.log_result(test_name, False, f"Invalid JSON: {str(e)}")
                return
            
        except requests.exceptions.RequestException as e:
            self.log_result(test_name, False, f"Request failed: {str(e)}")
        except Exception as e:
            self.log_result(test_name, False, f"Unexpected error: {str(e)}")
    
    def test_exam_submit(self):
        """Test /api/llm/exam/submit endpoint"""
        test_name = "Exam Submit"
        url = f"{BASE_URL}/api/llm/exam/submit"
        payload = {
            "answers": [
                {"question": "Test question?", "answer": "Test answer"}
            ],
            "subject": "Geschiedenis",
            "grade": 2,
            "chapter": "test-chapter"
        }
        
        try:
            response = requests.post(url, json=payload, timeout=30)
            print(f"Response status: {response.status_code}")
            print(f"Response headers: {dict(response.headers)}")
            
            if response.status_code != 200:
                try:
                    error_data = response.json()
                    self.log_result(test_name, False, f"Status {response.status_code}: {error_data}")
                except:
                    self.log_result(test_name, False, f"Status {response.status_code}: {response.text}")
                return
            
            # Check debug headers
            debug_header = response.headers.get('X-Debug')
            context_size = response.headers.get('X-Context-Size')
            
            if not debug_header:
                self.log_result(test_name, False, "Missing X-Debug header")
                return
            
            # Validate JSON structure
            try:
                data = response.json()
                required_fields = ['ok', 'score', 'feedback', 'summary']
                missing_fields = [field for field in required_fields if field not in data]
                
                if missing_fields:
                    self.log_result(test_name, False, f"Missing fields: {missing_fields}")
                    return
                
                self.log_result(test_name, True, f"Score: {data.get('score')}")
                
            except json.JSONDecodeError as e:
                self.log_result(test_name, False, f"Invalid JSON: {str(e)}")
                return
            
        except requests.exceptions.RequestException as e:
            self.log_result(test_name, False, f"Request failed: {str(e)}")
        except Exception as e:
            self.log_result(test_name, False, f"Unexpected error: {str(e)}")
    
    def test_grade_quiz(self):
        """Test /api/llm/grade-quiz endpoint"""
        test_name = "Grade Quiz"
        url = f"{BASE_URL}/api/llm/grade-quiz"
        payload = {
            "question": {
                "question_id": "test-q1",
                "type": "short_answer",
                "stem": "What is the capital of France?",
                "objective": "geography"
            },
            "student_answer": "Paris",
            "subject": "Geography",
            "grade": 2,
            "chapter": "test-chapter"
        }
        
        try:
            response = requests.post(url, json=payload, timeout=30)
            print(f"Response status: {response.status_code}")
            print(f"Response headers: {dict(response.headers)}")
            
            if response.status_code != 200:
                try:
                    error_data = response.json()
                    self.log_result(test_name, False, f"Status {response.status_code}: {error_data}")
                except:
                    self.log_result(test_name, False, f"Status {response.status_code}: {response.text}")
                return
            
            # Check debug headers
            llm_header = response.headers.get('X-Studiebot-LLM')
            
            if not llm_header:
                self.log_result(test_name, False, "Missing X-Studiebot-LLM header")
                return
            
            # Validate JSON structure
            try:
                data = response.json()
                required_fields = ['ok', 'is_correct', 'score', 'feedback', 'policy', 'db_ok']
                missing_fields = [field for field in required_fields if field not in data]
                
                if missing_fields:
                    self.log_result(test_name, False, f"Missing fields: {missing_fields}")
                    return
                
                self.log_result(test_name, True, f"Score: {data.get('score')}, Correct: {data.get('is_correct')}")
                
            except json.JSONDecodeError as e:
                self.log_result(test_name, False, f"Invalid JSON: {str(e)}")
                return
            
        except requests.exceptions.RequestException as e:
            self.log_result(test_name, False, f"Request failed: {str(e)}")
        except Exception as e:
            self.log_result(test_name, False, f"Unexpected error: {str(e)}")
    
    def test_service_health(self):
        """Test if services are running without errors"""
        test_name = "Service Health"
        
        try:
            # Test basic health endpoint
            health_url = f"{BASE_URL}/api/health"
            response = requests.get(health_url, timeout=10)
            
            if response.status_code == 200:
                self.log_result(test_name, True, "Health endpoint responding")
            else:
                self.log_result(test_name, False, f"Health endpoint returned {response.status_code}")
                
        except requests.exceptions.RequestException as e:
            self.log_result(test_name, False, f"Health check failed: {str(e)}")
        except Exception as e:
            self.log_result(test_name, False, f"Unexpected error: {str(e)}")
    
    def run_all_tests(self):
        """Run all tests for refactored LLM functionality"""
        print("🚀 Testing Refactored Studiebot LLM Prompts")
        print("=" * 50)
        
        # Initialize
        self.exam_id = None
        
        # Run tests
        self.test_service_health()
        self.test_quiz_generate_question()
        self.test_exam_generate()
        self.test_exam_submit()
        self.test_grade_quiz()
        
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
    tester = RefactoredLLMTester()
    success = tester.run_all_tests()
    
    # Exit with appropriate code
    sys.exit(0 if success else 1)

if __name__ == "__main__":
    main()