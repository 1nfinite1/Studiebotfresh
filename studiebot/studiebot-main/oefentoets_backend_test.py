#!/usr/bin/env python3
"""
Focused Backend Testing for Oefentoets JSON evaluation and response schema
Tests the /api/chat endpoint with Oefentoets mode focusing on:
1. Start action with 5 questions
2. Submit action with mixed answers (LLM fallback expected)
3. Robustness with empty answers
4. Optional Overhoren smoke test
"""

import requests
import json
import sys
import time
from typing import Dict, Any, List

# Base URL - using localhost since this is a Next.js app
BASE_URL = "http://localhost:3000/api"

def test_api_endpoint(endpoint: str, method: str = "POST", payload: Dict[Any, Any] = None, 
                     expected_status: int = 200, headers: Dict[str, str] = None) -> Dict[Any, Any]:
    """Generic API test function with detailed error reporting"""
    url = f"{BASE_URL}{endpoint}"
    
    if headers is None:
        headers = {"Content-Type": "application/json"}
    
    try:
        if method == "POST":
            response = requests.post(url, json=payload, headers=headers, timeout=30)
        elif method == "GET":
            response = requests.get(url, headers=headers, timeout=30)
        else:
            raise ValueError(f"Unsupported method: {method}")
        
        print(f"✓ {method} {endpoint} - Status: {response.status_code}")
        
        if response.status_code != expected_status:
            print(f"❌ Expected status {expected_status}, got {response.status_code}")
            print(f"Response: {response.text[:500]}...")
            return {"success": False, "status": response.status_code, "data": response.text}
        
        try:
            data = response.json()
            return {"success": True, "status": response.status_code, "data": data}
        except json.JSONDecodeError:
            return {"success": True, "status": response.status_code, "data": response.text}
            
    except requests.exceptions.RequestException as e:
        print(f"❌ Request failed: {e}")
        return {"success": False, "error": str(e)}

def validate_question_structure(questions: List[Dict], expected_count: int = 5) -> bool:
    """Validate questions array structure"""
    if not isinstance(questions, list):
        print(f"❌ Questions is not a list: {type(questions)}")
        return False
    
    if len(questions) != expected_count:
        print(f"❌ Expected {expected_count} questions, got {len(questions)}")
        return False
    
    for i, q in enumerate(questions):
        if not isinstance(q, dict):
            print(f"❌ Question {i+1} is not a dict: {type(q)}")
            return False
        
        if "id" not in q or not isinstance(q["id"], str):
            print(f"❌ Question {i+1} missing or invalid 'id' field")
            return False
        
        if "text" not in q or not isinstance(q["text"], str):
            print(f"❌ Question {i+1} missing or invalid 'text' field")
            return False
        
        if len(q["text"].strip()) == 0:
            print(f"❌ Question {i+1} has empty text")
            return False
    
    print(f"✅ All {len(questions)} questions have valid structure")
    return True

def validate_report_schema(report: Dict, questions: List[Dict]) -> bool:
    """Validate the report schema according to requirements"""
    required_fields = ["results", "correctCount", "total", "pct", "grade"]
    
    # Check required fields exist
    for field in required_fields:
        if field not in report:
            print(f"❌ Report missing required field: {field}")
            return False
    
    # Validate results array
    results = report["results"]
    if not isinstance(results, list):
        print(f"❌ Report.results is not a list: {type(results)}")
        return False
    
    if len(results) != len(questions):
        print(f"❌ Report.results length ({len(results)}) != questions length ({len(questions)})")
        return False
    
    # Validate each result
    for i, result in enumerate(results):
        if not isinstance(result, dict):
            print(f"❌ Result {i+1} is not a dict: {type(result)}")
            return False
        
        # Required fields for all responses
        required_result_fields = ["id", "text", "correct", "evaluation", "feedback", "answer"]
        for field in required_result_fields:
            if field not in result:
                print(f"❌ Result {i+1} missing field: {field}")
                return False
        
        # model_answer is optional (may be empty string in heuristic fallback)
        if "model_answer" not in result:
            print(f"⚠️ Result {i+1} missing optional field 'model_answer' (fallback mode)")
            # Add empty model_answer for validation
            result["model_answer"] = ""
        
        # Validate field types
        if not isinstance(result["id"], str):
            print(f"❌ Result {i+1} id is not string: {type(result['id'])}")
            return False
        
        if not isinstance(result["text"], str):
            print(f"❌ Result {i+1} text is not string: {type(result['text'])}")
            return False
        
        if not isinstance(result["correct"], bool):
            print(f"❌ Result {i+1} correct is not boolean: {type(result['correct'])}")
            return False
        
        if not isinstance(result["evaluation"], str):
            print(f"❌ Result {i+1} evaluation is not string: {type(result['evaluation'])}")
            return False
        
        # Validate evaluation values (case-insensitive)
        eval_lower = result["evaluation"].lower()
        if eval_lower not in ["juist", "onvolledig", "fout"]:
            print(f"❌ Result {i+1} evaluation invalid: {result['evaluation']} (expected: juist|onvolledig|fout)")
            return False
        
        if not isinstance(result["feedback"], str):
            print(f"❌ Result {i+1} feedback is not string: {type(result['feedback'])}")
            return False
        
        if not isinstance(result["model_answer"], str):
            print(f"❌ Result {i+1} model_answer is not string: {type(result['model_answer'])}")
            return False
        
        if not isinstance(result["answer"], str):
            print(f"❌ Result {i+1} answer is not string: {type(result['answer'])}")
            return False
    
    # Validate numeric fields
    if not isinstance(report["correctCount"], int) or report["correctCount"] < 0:
        print(f"❌ Report.correctCount invalid: {report['correctCount']}")
        return False
    
    if not isinstance(report["total"], int) or report["total"] <= 0:
        print(f"❌ Report.total invalid: {report['total']}")
        return False
    
    if report["total"] != len(questions):
        print(f"❌ Report.total ({report['total']}) != questions length ({len(questions)})")
        return False
    
    if not isinstance(report["pct"], int) or report["pct"] < 0 or report["pct"] > 100:
        print(f"❌ Report.pct invalid: {report['pct']} (expected: 0-100)")
        return False
    
    if not isinstance(report["grade"], (int, float)) or report["grade"] < 1.0 or report["grade"] > 10.0:
        print(f"❌ Report.grade invalid: {report['grade']} (expected: 1.0-10.0)")
        return False
    
    # Validate grade consistency
    expected_grade_range = None
    if report["pct"] == 0:
        expected_grade_range = (1.0, 1.1)  # Should be close to 1.0
    elif report["pct"] == 70:
        expected_grade_range = (5.4, 5.6)  # Should be close to 5.5
    elif report["pct"] == 100:
        expected_grade_range = (9.9, 10.0)  # Should be close to 10.0
    
    if expected_grade_range:
        if not (expected_grade_range[0] <= report["grade"] <= expected_grade_range[1]):
            print(f"⚠️ Grade consistency warning: pct={report['pct']}% -> grade={report['grade']} (expected ~{expected_grade_range})")
    
    # Validate optional fields
    if "wrongConcepts" in report:
        if not isinstance(report["wrongConcepts"], list):
            print(f"❌ Report.wrongConcepts is not a list: {type(report['wrongConcepts'])}")
            return False
    
    if "summary" in report:
        if not isinstance(report["summary"], str):
            print(f"❌ Report.summary is not a string: {type(report['summary'])}")
            return False
    
    if "recommendations" in report:
        if not isinstance(report["recommendations"], list):
            print(f"❌ Report.recommendations is not a list: {type(report['recommendations'])}")
            return False
    
    print(f"✅ Report schema validation passed")
    return True

def test_oefentoets_start():
    """Test 1: Start Oefentoets with 5 questions"""
    print("\n=== Test 1: Start Oefentoets (5 vragen) ===")
    
    payload = {
        "mode": "Oefentoets",
        "action": "start",
        "vak": "Geschiedenis",
        "leerjaar": "2",
        "hoofdstuk": "1",
        "payload": {
            "count": 5
        }
    }
    
    result = test_api_endpoint("/chat", "POST", payload)
    
    if not result["success"]:
        print("❌ Oefentoets start request failed")
        return False, None
    
    data = result["data"]
    
    # Validate response structure
    if "data" not in data:
        print(f"❌ Response missing 'data' field: {data}")
        return False, None
    
    if "questions" not in data["data"]:
        print(f"❌ Response missing 'data.questions' field: {data}")
        return False, None
    
    if "message" not in data:
        print(f"❌ Response missing 'message' field: {data}")
        return False, None
    
    questions = data["data"]["questions"]
    message = data["message"]
    
    # Validate questions structure
    if not validate_question_structure(questions, 5):
        return False, None
    
    print(f"✅ Message received: {message[:100]}...")
    print(f"✅ Questions sample: {questions[0]['text'][:80]}...")
    
    return True, questions

def test_oefentoets_submit_mixed(questions: List[Dict]):
    """Test 2: Submit Oefentoets with mixed answers (expecting LLM fallback)"""
    print("\n=== Test 2: Submit Oefentoets with mixed answers ===")
    
    if not questions or len(questions) < 5:
        print("❌ Invalid questions provided for submit test")
        return False
    
    # Create mixed answers as specified:
    # - First two: substantive answers (>=20 words)
    # - Third: short partial (~10 words)
    # - Fourth: empty string
    # - Fifth: single word
    answers = {}
    
    answers[questions[0]["id"]] = "De industriële revolutie was een periode van grote technologische veranderingen tussen 1760 en 1840, gekenmerkt door de overgang van handmatige naar mechanische productie met stoommachines en fabrieken."
    
    answers[questions[1]["id"]] = "James Watt verbeterde de stoommachine aanzienlijk, waardoor deze veel efficiënter werd. Dit leidde tot wijdverspreide toepassing in fabrieken, mijnen en transport, wat de industrialisatie versnelde."
    
    answers[questions[2]["id"]] = "Fabrieken, arbeiders, slechte omstandigheden, lange werkdagen"  # ~10 words
    
    answers[questions[3]["id"]] = ""  # Empty
    
    answers[questions[4]["id"]] = "Urbanisatie"  # Single word
    
    payload = {
        "mode": "Oefentoets",
        "action": "submit",
        "vak": "Geschiedenis",
        "leerjaar": "2",
        "hoofdstuk": "1",
        "payload": {
            "questions": questions,
            "answers": answers
        }
    }
    
    result = test_api_endpoint("/chat", "POST", payload)
    
    if not result["success"]:
        print("❌ Oefentoets submit request failed")
        return False
    
    data = result["data"]
    
    # Validate response structure
    if "data" not in data or "report" not in data["data"]:
        print(f"❌ Response missing 'data.report' field: {data}")
        return False
    
    if "message" not in data:
        print(f"❌ Response missing 'message' field: {data}")
        return False
    
    report = data["data"]["report"]
    message = data["message"]
    
    # Validate report schema
    if not validate_report_schema(report, questions):
        return False
    
    # Validate message contains score pattern
    score_pattern_found = False
    if "Je score:" in message and "%" in message and "Cijfer:" in message:
        score_pattern_found = True
        print(f"✅ Message contains required score pattern")
    else:
        print(f"❌ Message missing score pattern 'Je score: X/Y (Z%)' and 'Cijfer:'")
        print(f"Message: {message}")
        return False
    
    # Print summary
    print(f"✅ Report summary: {report['correctCount']}/{report['total']} ({report['pct']}%) - Grade: {report['grade']}")
    print(f"✅ Message preview: {message[:150]}...")
    
    return True

def test_oefentoets_submit_empty(questions: List[Dict]):
    """Test 3: Robustness - submit with all empty answers"""
    print("\n=== Test 3: Robustness - all empty answers ===")
    
    if not questions or len(questions) < 5:
        print("❌ Invalid questions provided for empty answers test")
        return False
    
    # All empty answers
    answers = {}
    for q in questions:
        answers[q["id"]] = ""
    
    payload = {
        "mode": "Oefentoets",
        "action": "submit",
        "vak": "Geschiedenis",
        "leerjaar": "2",
        "hoofdstuk": "1",
        "payload": {
            "questions": questions,
            "answers": answers
        }
    }
    
    result = test_api_endpoint("/chat", "POST", payload)
    
    if not result["success"]:
        print("❌ Oefentoets empty answers request failed")
        return False
    
    data = result["data"]
    
    # Validate response structure
    if "data" not in data or "report" not in data["data"]:
        print(f"❌ Response missing 'data.report' field: {data}")
        return False
    
    report = data["data"]["report"]
    
    # Validate report schema
    if not validate_report_schema(report, questions):
        return False
    
    # Validate expected results for empty answers
    if report["correctCount"] != 0:
        print(f"❌ Expected 0 correct answers, got {report['correctCount']}")
        return False
    
    if report["pct"] != 0:
        print(f"❌ Expected 0%, got {report['pct']}%")
        return False
    
    if report["grade"] < 1.0 or report["grade"] > 1.5:
        print(f"❌ Expected grade close to 1.0, got {report['grade']}")
        return False
    
    # Check that all results have evaluation set
    for i, result in enumerate(report["results"]):
        if result["evaluation"].lower() not in ["fout", "onvolledig"]:
            print(f"❌ Result {i+1} should be 'fout' or 'onvolledig', got '{result['evaluation']}'")
            return False
    
    print(f"✅ Empty answers handled correctly: 0/{report['total']} (0%) - Grade: {report['grade']}")
    return True

def test_overhoren_smoke():
    """Optional Test 4: Quick smoke test for Overhoren mode"""
    print("\n=== Test 4: Overhoren smoke test (optional) ===")
    
    payload = {
        "mode": "Overhoren",
        "vak": "Geschiedenis",
        "leerjaar": "2",
        "hoofdstuk": "1",
        "messages": [
            {
                "role": "user",
                "content": "Start"
            }
        ]
    }
    
    result = test_api_endpoint("/chat", "POST", payload)
    
    if not result["success"]:
        print("❌ Overhoren smoke test failed")
        return False
    
    data = result["data"]
    
    if "message" not in data:
        print(f"❌ Overhoren response missing 'message' field: {data}")
        return False
    
    message = data["message"]
    
    # Check if message contains a question (ends with ?)
    if not message.endswith("?"):
        print(f"❌ Overhoren message should end with '?': {message}")
        return False
    
    print(f"✅ Overhoren smoke test passed: {message[:100]}...")
    return True

def run_oefentoets_tests():
    """Run all Oefentoets backend tests"""
    print("🚀 Starting Oefentoets Backend Tests")
    print(f"Base URL: {BASE_URL}")
    print("Note: OPENAI_API_KEY may not be set - expecting graceful fallback to heuristic evaluation")
    
    results = {
        "start": False,
        "submit_mixed": False,
        "submit_empty": False,
        "overhoren_smoke": False
    }
    
    questions = None
    
    try:
        # Test 1: Start Oefentoets
        start_success, questions = test_oefentoets_start()
        results["start"] = start_success
        
        if start_success and questions:
            # Test 2: Submit with mixed answers
            results["submit_mixed"] = test_oefentoets_submit_mixed(questions)
            
            # Test 3: Submit with empty answers
            results["submit_empty"] = test_oefentoets_submit_empty(questions)
        
        # Test 4: Optional Overhoren smoke test
        results["overhoren_smoke"] = test_overhoren_smoke()
        
    except Exception as e:
        print(f"❌ Unexpected error during testing: {e}")
        import traceback
        traceback.print_exc()
        return False
    
    # Summary
    print("\n" + "="*60)
    print("📊 OEFENTOETS TEST RESULTS SUMMARY")
    print("="*60)
    
    total_tests = len(results)
    passed_tests = sum(results.values())
    
    for test_name, passed in results.items():
        status = "✅ PASS" if passed else "❌ FAIL"
        print(f"{test_name.upper().replace('_', ' ')}: {status}")
    
    print(f"\nOverall: {passed_tests}/{total_tests} tests passed")
    
    if passed_tests == total_tests:
        print("🎉 All Oefentoets backend tests PASSED!")
        return True
    else:
        print("⚠️  Some Oefentoets backend tests FAILED!")
        return False

if __name__ == "__main__":
    success = run_oefentoets_tests()
    sys.exit(0 if success else 1)