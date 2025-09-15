#!/usr/bin/env python3
"""
Backend API Testing for Studiebot /api/chat endpoints
Tests the three modes: Leren, Overhoren, and Oefentoets
"""

import requests
import json
import sys
import os
from typing import Dict, Any, List

# Get base URL from environment
BASE_URL = "http://localhost:3000/api"

def test_api_endpoint(endpoint: str, method: str = "POST", payload: Dict[Any, Any] = None, expected_status: int = 200) -> Dict[Any, Any]:
    """Generic API test function"""
    url = f"{BASE_URL}{endpoint}"
    
    try:
        if method == "POST":
            response = requests.post(url, json=payload, timeout=30)
        elif method == "GET":
            response = requests.get(url, timeout=30)
        else:
            raise ValueError(f"Unsupported method: {method}")
        
        print(f"✓ {method} {endpoint} - Status: {response.status_code}")
        
        if response.status_code != expected_status:
            print(f"❌ Expected status {expected_status}, got {response.status_code}")
            print(f"Response: {response.text}")
            return {"success": False, "status": response.status_code, "data": response.text}
        
        try:
            data = response.json()
            return {"success": True, "status": response.status_code, "data": data}
        except json.JSONDecodeError:
            return {"success": True, "status": response.status_code, "data": response.text}
            
    except requests.exceptions.RequestException as e:
        print(f"❌ Request failed: {e}")
        return {"success": False, "error": str(e)}

def test_leren_mode():
    """Test Leren mode: POST /api/chat with specific payload"""
    print("\n=== Testing Leren Mode ===")
    
    payload = {
        "mode": "Leren",
        "vak": "Geschiedenis", 
        "leerjaar": "2",
        "hoofdstuk": "1",
        "messages": [
            {
                "role": "user",
                "content": "Wat is de industriële revolutie?"
            }
        ]
    }
    
    result = test_api_endpoint("/chat", "POST", payload)
    
    if result["success"]:
        data = result["data"]
        if "message" in data:
            message = data["message"]
            print(f"✓ Received message: {message[:100]}...")
            
            # Check if message is in Dutch and has a question
            if "?" in message:
                print("✓ Message contains closing question")
                return True
            else:
                print("❌ Message does not contain closing question")
                return False
        else:
            print("❌ No 'message' field in response")
            return False
    else:
        print("❌ Leren mode test failed")
        return False

def test_overhoren_mode():
    """Test Overhoren mode: First call without previous assistant question, then with conversation"""
    print("\n=== Testing Overhoren Mode ===")
    
    # Test 1: First call without previous assistant question
    print("\n--- Test 1: First call (no previous assistant question) ---")
    payload1 = {
        "mode": "Overhoren",
        "vak": "Biologie",
        "messages": []
    }
    
    result1 = test_api_endpoint("/chat", "POST", payload1)
    
    if not result1["success"]:
        print("❌ First Overhoren call failed")
        return False
    
    data1 = result1["data"]
    if "message" not in data1:
        print("❌ No 'message' field in first response")
        return False
    
    message1 = data1["message"]
    print(f"✓ First response: {message1[:100]}...")
    
    if not message1.startswith("Vraag:"):
        print("❌ First response does not start with 'Vraag:'")
        return False
    
    print("✓ First response starts with 'Vraag:'")
    
    # Test 2: Second call with conversation history
    print("\n--- Test 2: Second call (with conversation history) ---")
    payload2 = {
        "mode": "Overhoren",
        "vak": "Biologie", 
        "messages": [
            {
                "role": "assistant",
                "content": message1  # Use the question from first response
            },
            {
                "role": "user",
                "content": "De cel is de kleinste eenheid van leven en bevat alle processen die nodig zijn voor het functioneren van een organisme."
            }
        ]
    }
    
    result2 = test_api_endpoint("/chat", "POST", payload2)
    
    if not result2["success"]:
        print("❌ Second Overhoren call failed")
        return False
    
    data2 = result2["data"]
    if "message" not in data2:
        print("❌ No 'message' field in second response")
        return False
    
    message2 = data2["message"]
    print(f"✓ Second response: {message2[:100]}...")
    
    # Check if response contains feedback and either "Volgende:" or reflection prompt
    has_feedback = any(word in message2.lower() for word in ["correct", "goed", "bijna", "feedback", "✔️"])
    has_next_or_reflection = "Volgende:" in message2 or "uitleggen wat je" in message2 or "geleerd hebt" in message2
    
    if has_feedback:
        print("✓ Response contains feedback")
    else:
        print("❌ Response does not contain clear feedback")
        return False
    
    if has_next_or_reflection:
        print("✓ Response contains 'Volgende:' or reflection prompt")
    else:
        print("❌ Response does not contain 'Volgende:' or reflection prompt")
        return False
    
    return True

def test_oefentoets_mode():
    """Test Oefentoets mode: Start action and Submit action"""
    print("\n=== Testing Oefentoets Mode ===")
    
    # Test 1: Start action
    print("\n--- Test 1: Start action ---")
    payload_start = {
        "mode": "Oefentoets",
        "vak": "Wiskunde",
        "action": "start",
        "payload": {
            "count": 5
        }
    }
    
    result_start = test_api_endpoint("/chat", "POST", payload_start)
    
    if not result_start["success"]:
        print("❌ Oefentoets start failed")
        return False
    
    data_start = result_start["data"]
    if "data" not in data_start or "questions" not in data_start["data"]:
        print("❌ No 'data.questions' field in start response")
        print(f"Response: {data_start}")
        return False
    
    questions = data_start["data"]["questions"]
    if len(questions) != 5:
        print(f"❌ Expected 5 questions, got {len(questions)}")
        return False
    
    print(f"✓ Received {len(questions)} questions")
    
    # Verify question structure
    for i, q in enumerate(questions):
        if "id" not in q or "text" not in q:
            print(f"❌ Question {i+1} missing 'id' or 'text' field")
            return False
    
    print("✓ All questions have proper structure")
    
    if "message" in data_start:
        print(f"✓ Server message: {data_start['message']}")
    
    # Test 2: Submit action
    print("\n--- Test 2: Submit action ---")
    
    # Create sample answers for the questions
    answers = {}
    for q in questions:
        answers[q["id"]] = "Dit is een voorbeeld antwoord met kernbegrip en voorbeeld"
    
    payload_submit = {
        "mode": "Oefentoets",
        "vak": "Wiskunde",
        "action": "submit",
        "payload": {
            "questions": questions,
            "answers": answers
        }
    }
    
    result_submit = test_api_endpoint("/chat", "POST", payload_submit)
    
    if not result_submit["success"]:
        print("❌ Oefentoets submit failed")
        return False
    
    data_submit = result_submit["data"]
    if "data" not in data_submit or "report" not in data_submit["data"]:
        print("❌ No 'data.report' field in submit response")
        print(f"Response: {data_submit}")
        return False
    
    report = data_submit["data"]["report"]
    required_fields = ["correctCount", "total", "pct", "grade"]
    
    for field in required_fields:
        if field not in report:
            print(f"❌ Report missing '{field}' field")
            return False
    
    print(f"✓ Report contains all required fields: {required_fields}")
    print(f"✓ Score: {report['correctCount']}/{report['total']} ({report['pct']}%) - Grade: {report['grade']}")
    
    # Check message contains CTA text
    if "message" in data_submit:
        message = data_submit["message"]
        if "Oefen nu met Overhoren op je fouten" in message:
            print("✓ Message contains CTA text 'Oefen nu met Overhoren op je fouten'")
        else:
            print("❌ Message does not contain expected CTA text")
            return False
    else:
        print("❌ No message field in submit response")
        return False
    
    return True

def run_all_tests():
    """Run all backend tests"""
    print("🚀 Starting Backend API Tests for Studiebot")
    print(f"Base URL: {BASE_URL}")
    
    results = {
        "leren": False,
        "overhoren": False, 
        "oefentoets": False
    }
    
    try:
        # Test Leren mode
        results["leren"] = test_leren_mode()
        
        # Test Overhoren mode
        results["overhoren"] = test_overhoren_mode()
        
        # Test Oefentoets mode
        results["oefentoets"] = test_oefentoets_mode()
        
    except Exception as e:
        print(f"❌ Unexpected error during testing: {e}")
        return False
    
    # Summary
    print("\n" + "="*50)
    print("📊 TEST RESULTS SUMMARY")
    print("="*50)
    
    total_tests = len(results)
    passed_tests = sum(results.values())
    
    for test_name, passed in results.items():
        status = "✅ PASS" if passed else "❌ FAIL"
        print(f"{test_name.upper()}: {status}")
    
    print(f"\nOverall: {passed_tests}/{total_tests} tests passed")
    
    if passed_tests == total_tests:
        print("🎉 All backend tests PASSED!")
        return True
    else:
        print("⚠️  Some backend tests FAILED!")
        return False

if __name__ == "__main__":
    success = run_all_tests()
    sys.exit(0 if success else 1)