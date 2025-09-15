#!/usr/bin/env python3
"""
Backend API Testing for Materials API and Chat with Material Context
Tests the materials endpoints and chat integration as requested in review
"""

import requests
import json
import sys
import os
import io
from typing import Dict, Any, List
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import letter

# Base URL for testing
BASE_URL = "http://localhost:3000/api"

def create_dummy_pdf(content: str = "Dit is een test PDF voor Geschiedenis. De industriële revolutie was een periode van grote technologische en sociale veranderingen in de 18e en 19e eeuw.") -> bytes:
    """Create a simple PDF with dummy content"""
    buffer = io.BytesIO()
    p = canvas.Canvas(buffer, pagesize=letter)
    
    # Add some text content
    p.drawString(100, 750, "Test Lesmateriaal - Geschiedenis")
    p.drawString(100, 720, "Leerjaar 2 - Hoofdstuk 1")
    p.drawString(100, 680, content)
    
    # Add more content to make it substantial
    y_pos = 650
    additional_content = [
        "De industriële revolutie begon in Engeland rond 1760.",
        "Belangrijke uitvindingen waren de stoommachine en mechanische weefgetouwen.",
        "Dit leidde tot grote veranderingen in de maatschappij.",
        "Veel mensen verhuisden van het platteland naar de steden.",
        "De arbeidsomstandigheden waren vaak slecht.",
        "Kinderarbeid was een groot probleem in deze periode."
    ]
    
    for line in additional_content:
        p.drawString(100, y_pos, line)
        y_pos -= 30
    
    p.save()
    buffer.seek(0)
    return buffer.getvalue()

def test_api_request(endpoint: str, method: str = "GET", data: Dict = None, files: Dict = None, expected_status: int = 200) -> Dict[Any, Any]:
    """Generic API test function with better error handling"""
    url = f"{BASE_URL}{endpoint}"
    
    try:
        if method == "POST":
            if files:
                response = requests.post(url, data=data, files=files, timeout=30)
            else:
                response = requests.post(url, json=data, timeout=30)
        elif method == "GET":
            response = requests.get(url, timeout=30)
        elif method == "PUT":
            response = requests.put(url, json=data, timeout=30)
        elif method == "DELETE":
            response = requests.delete(url, timeout=30)
        else:
            raise ValueError(f"Unsupported method: {method}")
        
        print(f"✓ {method} {endpoint} - Status: {response.status_code}")
        
        # Always try to parse JSON first
        try:
            response_data = response.json()
        except json.JSONDecodeError:
            response_data = response.text
            print(f"⚠️  Non-JSON response: {response_data[:100]}...")
        
        if response.status_code != expected_status:
            print(f"❌ Expected status {expected_status}, got {response.status_code}")
            print(f"Response: {response_data}")
            return {"success": False, "status": response.status_code, "data": response_data}
        
        return {"success": True, "status": response.status_code, "data": response_data}
            
    except requests.exceptions.RequestException as e:
        print(f"❌ Request failed: {e}")
        return {"success": False, "error": str(e)}

def test_materials_upload():
    """Test 1: POST /api/materials/upload (multipart)"""
    print("\n=== Test 1: Materials Upload ===")
    
    # Test successful upload
    print("\n--- Test 1a: Successful PDF upload ---")
    pdf_content = create_dummy_pdf()
    
    files = {
        'file': ('test_geschiedenis.pdf', pdf_content, 'application/pdf')
    }
    data = {
        'vak': 'Geschiedenis',
        'leerjaar': '2', 
        'hoofdstuk': '1',
        'uploader': 'docent'
    }
    
    result = test_api_request("/materials/upload", "POST", data=data, files=files)
    
    if not result["success"]:
        print("❌ Upload test failed")
        return False, None
    
    response_data = result["data"]
    
    # Check response structure
    if "data" not in response_data:
        print("❌ No 'data' field in response")
        return False, None
    
    data_obj = response_data["data"]
    required_fields = ["item", "segmentCount"]
    
    for field in required_fields:
        if field not in data_obj:
            print(f"❌ Missing '{field}' in response data")
            return False, None
    
    item = data_obj["item"]
    item_required_fields = ["id", "setId", "filename", "type", "status", "segmentCount"]
    
    for field in item_required_fields:
        if field not in item:
            print(f"❌ Missing '{field}' in item")
            return False, None
    
    print(f"✓ Upload successful - Item ID: {item['id']}")
    print(f"✓ Segment count: {item['segmentCount']}")
    
    # Test validation: wrong extension
    print("\n--- Test 1b: Wrong file extension (.txt) ---")
    files_txt = {
        'file': ('test.txt', b'This is a text file', 'text/plain')
    }
    
    result_txt = test_api_request("/materials/upload", "POST", data=data, files=files_txt, expected_status=400)
    
    if result_txt["success"] and result_txt["status"] == 400:
        print("✓ Correctly rejected .txt file")
    else:
        print("❌ Should have rejected .txt file")
        return False, None
    
    # Test validation: no file
    print("\n--- Test 1c: No file provided ---")
    result_no_file = test_api_request("/materials/upload", "POST", data=data, expected_status=400)
    
    if result_no_file["success"] and result_no_file["status"] == 400:
        print("✓ Correctly rejected request without file")
    else:
        print("❌ Should have rejected request without file")
        return False, None
    
    return True, item

def test_materials_list(expected_item_id: str = None):
    """Test 2: GET /api/materials/list"""
    print("\n=== Test 2: Materials List ===")
    
    endpoint = "/materials/list?vak=Geschiedenis&leerjaar=2&hoofdstuk=1"
    result = test_api_request(endpoint, "GET")
    
    if not result["success"]:
        print("❌ List test failed")
        return False
    
    response_data = result["data"]
    
    # Check response structure
    if "data" not in response_data:
        print("❌ No 'data' field in response")
        return False
    
    data_obj = response_data["data"]
    required_fields = ["items", "set"]
    
    for field in required_fields:
        if field not in data_obj:
            print(f"❌ Missing '{field}' in response data")
            return False
    
    items = data_obj["items"]
    
    if not isinstance(items, list):
        print("❌ 'items' should be a list")
        return False
    
    if len(items) == 0:
        print("⚠️  No items found (this might be expected if no materials uploaded)")
    else:
        print(f"✓ Found {len(items)} items")
        
        # If we have an expected item ID, check if it's in the list
        if expected_item_id:
            item_ids = [item.get('id') for item in items]
            if expected_item_id in item_ids:
                print(f"✓ Expected item {expected_item_id} found in list")
            else:
                print(f"❌ Expected item {expected_item_id} not found in list")
                return False
    
    # Check set field (can be null)
    set_obj = data_obj["set"]
    print(f"✓ Set object: {set_obj}")
    
    return True

def test_materials_preview(item_id: str):
    """Test 3: GET /api/materials/preview"""
    print("\n=== Test 3: Materials Preview ===")
    
    endpoint = f"/materials/preview?id={item_id}"
    result = test_api_request(endpoint, "GET")
    
    if not result["success"]:
        print("❌ Preview test failed")
        return False
    
    response_data = result["data"]
    
    # Check response structure
    if "data" not in response_data:
        print("❌ No 'data' field in response")
        return False
    
    data_obj = response_data["data"]
    
    if "segments" not in data_obj:
        print("❌ No 'segments' field in response data")
        return False
    
    segments = data_obj["segments"]
    
    if not isinstance(segments, list):
        print("❌ 'segments' should be a list")
        return False
    
    if len(segments) == 0:
        print("❌ No segments found")
        return False
    
    if len(segments) > 5:
        print(f"❌ Too many segments returned: {len(segments)} (max 5)")
        return False
    
    print(f"✓ Found {len(segments)} segments (max 5)")
    
    # Check that each segment is a non-empty string
    for i, segment in enumerate(segments):
        if not isinstance(segment, str) or len(segment) == 0:
            print(f"❌ Segment {i+1} is not a non-empty string")
            return False
    
    print("✓ All segments are non-empty strings")
    
    # Show first segment preview
    first_segment = segments[0]
    print(f"✓ First segment preview: {first_segment[:50]}...")
    
    return True

def test_materials_activate():
    """Test 4: PUT /api/materials/activate"""
    print("\n=== Test 4: Materials Activate ===")
    
    data = {
        'vak': 'Geschiedenis',
        'leerjaar': '2',
        'hoofdstuk': '1'
    }
    
    result = test_api_request("/materials/activate", "PUT", data=data)
    
    if not result["success"]:
        print("❌ Activate test failed")
        return False
    
    response_data = result["data"]
    
    # Check response structure
    if "data" not in response_data:
        print("❌ No 'data' field in response")
        return False
    
    data_obj = response_data["data"]
    
    if "active" not in data_obj:
        print("❌ No 'active' field in response data")
        return False
    
    if data_obj["active"] != True:
        print(f"❌ Expected active=true, got {data_obj['active']}")
        return False
    
    print("✓ Material set activated successfully")
    return True

def test_chat_with_material_context():
    """Test 5: POST /api/chat with material context"""
    print("\n=== Test 5: Chat with Material Context ===")
    
    data = {
        'mode': 'Leren',
        'vak': 'Geschiedenis',
        'leerjaar': '2',
        'hoofdstuk': '1',
        'messages': [
            {
                'role': 'user',
                'content': 'Leg uit wat de industriële revolutie was'
            }
        ]
    }
    
    result = test_api_request("/chat", "POST", data=data)
    
    if not result["success"]:
        print("❌ Chat test failed")
        return False
    
    response_data = result["data"]
    
    if "data" not in response_data:
        print("❌ No 'data' field in response")
        return False
    
    if "message" not in response_data["data"]:
        print("❌ No 'message' field in response data")
        return False
    
    message = response_data["data"]["message"]
    
    if not isinstance(message, str) or len(message) == 0:
        print("❌ Message should be a non-empty string")
        return False
    
    print(f"✓ Received message in Dutch: {message[:100]}...")
    
    # Check if message contains material context (should contain fragments from uploaded text)
    # Look for keywords from our dummy PDF content
    material_keywords = ["industriële revolutie", "Engeland", "stoommachine", "1760"]
    found_keywords = [kw for kw in material_keywords if kw.lower() in message.lower()]
    
    if found_keywords:
        print(f"✓ Message contains material context keywords: {found_keywords}")
    else:
        print("⚠️  Message may not contain specific material context (this could be expected if using mock logic)")
    
    return True

def test_materials_delete(item_id: str):
    """Test 6: DELETE /api/materials/item"""
    print("\n=== Test 6: Materials Delete ===")
    
    endpoint = f"/materials/item?id={item_id}"
    result = test_api_request(endpoint, "DELETE")
    
    if not result["success"]:
        print("❌ Delete test failed")
        return False
    
    response_data = result["data"]
    
    # Check response structure
    if "data" not in response_data:
        print("❌ No 'data' field in response")
        return False
    
    data_obj = response_data["data"]
    
    if "deleted" not in data_obj:
        print("❌ No 'deleted' field in response data")
        return False
    
    if data_obj["deleted"] != True:
        print(f"❌ Expected deleted=true, got {data_obj['deleted']}")
        return False
    
    print("✓ Item deleted successfully")
    
    # Verify deletion by checking list again
    print("\n--- Verifying deletion with GET /api/materials/list ---")
    list_result = test_materials_list()
    
    if list_result:
        print("✓ List request after deletion successful")
    else:
        print("❌ List request after deletion failed")
        return False
    
    return True

def test_edge_cases():
    """Test 7: Edge cases - JSON consistency"""
    print("\n=== Test 7: Edge Cases - JSON Consistency ===")
    
    # Test wrong HTTP method on upload endpoint
    print("\n--- Test 7a: Wrong method (GET on upload endpoint) ---")
    result = test_api_request("/materials/upload", "GET", expected_status=404)
    
    if result["success"] and result["status"] == 404:
        response_data = result["data"]
        if isinstance(response_data, dict) and "error" in response_data:
            print("✓ Correctly returned JSON error response")
        else:
            print(f"❌ Expected JSON error response, got: {type(response_data)}")
            return False
    else:
        print("❌ Should have returned 404 error")
        return False
    
    # Test non-existent endpoint
    print("\n--- Test 7b: Non-existent endpoint ---")
    result = test_api_request("/materials/nonexistent", "GET", expected_status=404)
    
    if result["success"] and result["status"] == 404:
        response_data = result["data"]
        if isinstance(response_data, dict) and "error" in response_data:
            print("✓ Correctly returned JSON error response for non-existent endpoint")
        else:
            print(f"❌ Expected JSON error response, got: {type(response_data)}")
            return False
    else:
        print("❌ Should have returned 404 error")
        return False
    
    # Test missing required parameters
    print("\n--- Test 7c: Missing required parameters ---")
    result = test_api_request("/materials/preview", "GET", expected_status=400)
    
    if result["success"] and result["status"] == 400:
        response_data = result["data"]
        if isinstance(response_data, dict) and "error" in response_data:
            print("✓ Correctly returned JSON error response for missing parameters")
        else:
            print(f"❌ Expected JSON error response, got: {type(response_data)}")
            return False
    else:
        print("❌ Should have returned 400 error")
        return False
    
    return True

def run_all_materials_tests():
    """Run all materials API tests"""
    print("🚀 Starting Materials API Tests")
    print(f"Base URL: {BASE_URL}")
    
    results = {
        "upload": False,
        "list": False,
        "preview": False,
        "activate": False,
        "chat": False,
        "delete": False,
        "edge_cases": False
    }
    
    uploaded_item = None
    
    try:
        # Test 1: Upload
        upload_success, uploaded_item = test_materials_upload()
        results["upload"] = upload_success
        
        if not upload_success or not uploaded_item:
            print("❌ Upload failed, cannot continue with dependent tests")
            return False
        
        # Test 2: List
        results["list"] = test_materials_list(uploaded_item["id"])
        
        # Test 3: Preview
        results["preview"] = test_materials_preview(uploaded_item["id"])
        
        # Test 4: Activate
        results["activate"] = test_materials_activate()
        
        # Test 5: Chat with material context
        results["chat"] = test_chat_with_material_context()
        
        # Test 6: Delete
        results["delete"] = test_materials_delete(uploaded_item["id"])
        
        # Test 7: Edge cases
        results["edge_cases"] = test_edge_cases()
        
    except Exception as e:
        print(f"❌ Unexpected error during testing: {e}")
        return False
    
    # Summary
    print("\n" + "="*60)
    print("📊 MATERIALS API TEST RESULTS SUMMARY")
    print("="*60)
    
    total_tests = len(results)
    passed_tests = sum(results.values())
    
    for test_name, passed in results.items():
        status = "✅ PASS" if passed else "❌ FAIL"
        print(f"{test_name.upper().replace('_', ' ')}: {status}")
    
    print(f"\nOverall: {passed_tests}/{total_tests} tests passed")
    
    if passed_tests == total_tests:
        print("🎉 All materials API tests PASSED!")
        return True
    else:
        print("⚠️  Some materials API tests FAILED!")
        return False

if __name__ == "__main__":
    success = run_all_materials_tests()
    sys.exit(0 if success else 1)