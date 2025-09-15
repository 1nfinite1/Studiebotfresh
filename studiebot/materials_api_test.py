#!/usr/bin/env python3
"""
Materials API Testing for Studiebot
Tests the materials endpoints step-by-step as requested:
1. POST /api/materials/upload - upload a small valid PDF
2. GET /api/materials/list - search for the uploaded item
3. GET /api/materials/preview - get preview with segments
4. Negative test: GET /api/materials/preview without id
5. Verify segments are valid strings with length > 0
"""

import requests
import json
import sys
import os
import io
from typing import Dict, Any, List

# Base URL for the Next.js app
BASE_URL = "http://localhost:3000/api"

def create_test_pdf():
    """Create a simple test PDF content"""
    # Simple PDF content with minimal structure
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
/Resources <<
/Font <<
/F1 5 0 R
>>
>>
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
(Dit is een test PDF voor Geschiedenis.) Tj
ET
endstream
endobj

5 0 obj
<<
/Type /Font
/Subtype /Type1
/BaseFont /Helvetica
>>
endobj

xref
0 6
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000274 00000 n 
0000000373 00000 n 
trailer
<<
/Size 6
/Root 1 0 R
>>
startxref
456
%%EOF"""
    return pdf_content

def test_upload_material():
    """Step 1: POST /api/materials/upload - upload a small valid PDF"""
    print("\n=== STEP 1: Testing POST /api/materials/upload ===")
    
    url = f"{BASE_URL}/materials/upload"
    
    # Create test PDF
    pdf_content = create_test_pdf()
    
    # Prepare multipart form data
    files = {
        'file': ('test.pdf', pdf_content, 'application/pdf')
    }
    
    data = {
        'vak': 'Geschiedenis',
        'leerjaar': '2', 
        'hoofdstuk': '1',
        'uploader': 'docent'
    }
    
    try:
        print(f"Uploading PDF to: {url}")
        print(f"Form data: {data}")
        
        response = requests.post(url, files=files, data=data, timeout=30)
        
        print(f"Status Code: {response.status_code}")
        print(f"Response Headers: {dict(response.headers)}")
        
        if response.status_code == 200:
            try:
                result = response.json()
                print(f"✅ Upload successful!")
                print(f"Response: {json.dumps(result, indent=2)}")
                
                if 'data' in result and 'item' in result['data']:
                    item = result['data']['item']
                    material_id = item.get('id')
                    segment_count = item.get('segmentCount', 0)
                    
                    print(f"📋 Material ID: {material_id}")
                    print(f"📊 Segment Count: {segment_count}")
                    
                    return {
                        'success': True,
                        'material_id': material_id,
                        'segment_count': segment_count,
                        'item': item
                    }
                else:
                    print("❌ Response missing expected data structure")
                    return {'success': False, 'error': 'Invalid response structure'}
                    
            except json.JSONDecodeError as e:
                print(f"❌ Failed to parse JSON response: {e}")
                print(f"Raw response: {response.text}")
                return {'success': False, 'error': 'Invalid JSON response'}
        else:
            print(f"❌ Upload failed with status {response.status_code}")
            print(f"Response: {response.text}")
            return {'success': False, 'status': response.status_code, 'error': response.text}
            
    except requests.exceptions.RequestException as e:
        print(f"❌ Request failed: {e}")
        return {'success': False, 'error': str(e)}

def test_list_materials():
    """Step 2: GET /api/materials/list - search for uploaded materials"""
    print("\n=== STEP 2: Testing GET /api/materials/list ===")
    
    url = f"{BASE_URL}/materials/list"
    params = {
        'vak': 'Geschiedenis',
        'leerjaar': '2',
        'hoofdstuk': '1'
    }
    
    try:
        print(f"Fetching materials from: {url}")
        print(f"Query params: {params}")
        
        response = requests.get(url, params=params, timeout=30)
        
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            try:
                result = response.json()
                print(f"✅ List request successful!")
                print(f"Response: {json.dumps(result, indent=2)}")
                
                if 'data' in result and 'items' in result['data']:
                    items = result['data']['items']
                    print(f"📋 Found {len(items)} materials")
                    
                    # Look for test.pdf
                    test_item = None
                    for item in items:
                        if item.get('filename') == 'test.pdf':
                            test_item = item
                            break
                    
                    if test_item:
                        print(f"✅ Found test.pdf with ID: {test_item.get('id')}")
                        return {
                            'success': True,
                            'items': items,
                            'test_item': test_item,
                            'material_id': test_item.get('id')
                        }
                    else:
                        print("❌ test.pdf not found in materials list")
                        return {'success': False, 'error': 'test.pdf not found'}
                else:
                    print("❌ Response missing expected data structure")
                    return {'success': False, 'error': 'Invalid response structure'}
                    
            except json.JSONDecodeError as e:
                print(f"❌ Failed to parse JSON response: {e}")
                print(f"Raw response: {response.text}")
                return {'success': False, 'error': 'Invalid JSON response'}
        else:
            print(f"❌ List request failed with status {response.status_code}")
            print(f"Response: {response.text}")
            return {'success': False, 'status': response.status_code, 'error': response.text}
            
    except requests.exceptions.RequestException as e:
        print(f"❌ Request failed: {e}")
        return {'success': False, 'error': str(e)}

def test_preview_material(material_id):
    """Step 3: GET /api/materials/preview - get preview with segments"""
    print(f"\n=== STEP 3: Testing GET /api/materials/preview?id={material_id} ===")
    
    url = f"{BASE_URL}/materials/preview"
    params = {'id': material_id}
    
    try:
        print(f"Fetching preview from: {url}")
        print(f"Query params: {params}")
        
        response = requests.get(url, params=params, timeout=30)
        
        print(f"Status Code: {response.status_code}")
        print(f"Response Body: {response.text}")
        
        if response.status_code == 200:
            try:
                result = response.json()
                print(f"✅ Preview request successful!")
                print(f"Response: {json.dumps(result, indent=2)}")
                
                if 'data' in result and 'segments' in result['data']:
                    segments = result['data']['segments']
                    print(f"📋 Found {len(segments)} segments (max 5 expected)")
                    
                    # Verify segments are valid strings with length > 0
                    valid_segments = True
                    for i, segment in enumerate(segments):
                        if not isinstance(segment, str) or len(segment) == 0:
                            print(f"❌ Segment {i+1} is not a valid string or is empty")
                            valid_segments = False
                        else:
                            print(f"✅ Segment {i+1}: {len(segment)} characters - '{segment[:50]}...'")
                    
                    if valid_segments:
                        print("✅ All segments are valid strings with length > 0")
                        return {
                            'success': True,
                            'segments': segments,
                            'segment_count': len(segments)
                        }
                    else:
                        return {'success': False, 'error': 'Invalid segments found'}
                else:
                    print("❌ Response missing expected data structure")
                    return {'success': False, 'error': 'Invalid response structure'}
                    
            except json.JSONDecodeError as e:
                print(f"❌ Failed to parse JSON response: {e}")
                print(f"Raw response: {response.text}")
                return {'success': False, 'error': 'Invalid JSON response'}
        else:
            print(f"❌ Preview request failed with status {response.status_code}")
            print(f"Response: {response.text}")
            return {'success': False, 'status': response.status_code, 'error': response.text}
            
    except requests.exceptions.RequestException as e:
        print(f"❌ Request failed: {e}")
        return {'success': False, 'error': str(e)}

def test_preview_without_id():
    """Step 4: Negative test - GET /api/materials/preview without id"""
    print("\n=== STEP 4: Testing GET /api/materials/preview (without id) ===")
    
    url = f"{BASE_URL}/materials/preview"
    
    try:
        print(f"Fetching preview from: {url} (no id parameter)")
        
        response = requests.get(url, timeout=30)
        
        print(f"Status Code: {response.status_code}")
        print(f"Response Body: {response.text}")
        
        if response.status_code == 400:
            try:
                result = response.json()
                print(f"✅ Correctly returned 400 status!")
                print(f"Response: {json.dumps(result, indent=2)}")
                
                if 'error' in result:
                    print(f"✅ Error message: {result['error']}")
                    return {
                        'success': True,
                        'status': response.status_code,
                        'error_message': result['error']
                    }
                else:
                    print("❌ Response missing error field")
                    return {'success': False, 'error': 'Missing error field'}
                    
            except json.JSONDecodeError as e:
                print(f"❌ Failed to parse JSON response: {e}")
                print(f"Raw response: {response.text}")
                return {'success': False, 'error': 'Invalid JSON response'}
        else:
            print(f"❌ Expected status 400, got {response.status_code}")
            print(f"Response: {response.text}")
            return {'success': False, 'status': response.status_code, 'error': 'Unexpected status code'}
            
    except requests.exceptions.RequestException as e:
        print(f"❌ Request failed: {e}")
        return {'success': False, 'error': str(e)}

def run_materials_api_tests():
    """Run all materials API tests step by step"""
    print("🚀 Starting Materials API Tests for Studiebot")
    print(f"Base URL: {BASE_URL}")
    
    results = {
        'upload': None,
        'list': None,
        'preview': None,
        'preview_negative': None
    }
    
    try:
        # Step 1: Upload material
        upload_result = test_upload_material()
        results['upload'] = upload_result
        
        if not upload_result['success']:
            print("❌ Upload failed, cannot continue with remaining tests")
            return results
        
        material_id = upload_result.get('material_id')
        if not material_id:
            print("❌ No material ID returned from upload, cannot continue")
            return results
        
        # Step 2: List materials
        list_result = test_list_materials()
        results['list'] = list_result
        
        # Use material_id from upload if list doesn't find it
        if list_result['success']:
            found_id = list_result.get('material_id')
            if found_id:
                material_id = found_id
        
        # Step 3: Preview material
        preview_result = test_preview_material(material_id)
        results['preview'] = preview_result
        
        # Step 4: Negative test - preview without id
        negative_result = test_preview_without_id()
        results['preview_negative'] = negative_result
        
    except Exception as e:
        print(f"❌ Unexpected error during testing: {e}")
        return results
    
    # Summary
    print("\n" + "="*60)
    print("📊 MATERIALS API TEST RESULTS SUMMARY")
    print("="*60)
    
    test_names = [
        ('upload', 'POST /api/materials/upload'),
        ('list', 'GET /api/materials/list'),
        ('preview', 'GET /api/materials/preview'),
        ('preview_negative', 'GET /api/materials/preview (no id)')
    ]
    
    passed_tests = 0
    total_tests = len(test_names)
    
    for key, description in test_names:
        result = results.get(key)
        if result and result.get('success'):
            status = "✅ PASS"
            passed_tests += 1
        else:
            status = "❌ FAIL"
            if result and 'error' in result:
                status += f" - {result['error']}"
        
        print(f"{description}: {status}")
    
    print(f"\nOverall: {passed_tests}/{total_tests} tests passed")
    
    if passed_tests == total_tests:
        print("🎉 All materials API tests PASSED!")
        return True
    else:
        print("⚠️  Some materials API tests FAILED!")
        return False

if __name__ == "__main__":
    success = run_materials_api_tests()
    sys.exit(0 if success else 1)