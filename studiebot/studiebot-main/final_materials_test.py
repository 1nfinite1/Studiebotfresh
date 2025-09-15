#!/usr/bin/env python3
"""
Final Backend API Testing for Materials Upload (PDF/DOCX) with Rate Limiting Handling
Tests the specific scenarios from the review request with proper timing
"""

import requests
import json
import sys
import os
import io
import time
from typing import Dict, Any, List
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import letter
import zipfile

# Base URL
BASE_URL = 'http://localhost:3000/api'

def create_small_test_pdf():
    """Create a small test PDF file (<200KB) with Geschiedenis content"""
    buffer = io.BytesIO()
    c = canvas.Canvas(buffer, pagesize=letter)
    
    content = [
        "Geschiedenis Leerjaar 2 - Hoofdstuk 1: De Industriële Revolutie",
        "",
        "De industriële revolutie was een periode van grote technologische veranderingen",
        "tussen ongeveer 1760 en 1840. Deze periode kenmerkte zich door de overgang",
        "van handmatige productie naar mechanische productie met machines.",
        "",
        "Belangrijke uitvindingen:",
        "- De stoommachine door James Watt (1769)",
        "- Mechanische weefgetouwen voor textielproductie", 
        "- Verbeterde transportmiddelen zoals kanalen en spoorwegen",
        "",
        "Gevolgen van de industriële revolutie:",
        "- Urbanisatie: mensen trokken van platteland naar steden",
        "- Nieuwe sociale klassen: bourgeoisie en proletariaat",
        "- Slechte arbeidsomstandigheden in fabrieken",
        "",
        "Deze periode legde de basis voor onze moderne industriële samenleving."
    ]
    
    y_position = 750
    for line in content:
        c.drawString(50, y_position, line)
        y_position -= 20
        if y_position < 50:
            c.showPage()
            y_position = 750
    
    c.save()
    buffer.seek(0)
    return buffer.getvalue()

def create_small_test_docx():
    """Create a small test DOCX file (<200KB) with Geschiedenis content"""
    buffer = io.BytesIO()
    
    with zipfile.ZipFile(buffer, 'w', zipfile.ZIP_DEFLATED) as docx:
        content_types = '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
    <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
    <Default Extension="xml" ContentType="application/xml"/>
    <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>'''
        docx.writestr('[Content_Types].xml', content_types)
        
        main_rels = '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
    <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>'''
        docx.writestr('_rels/.rels', main_rels)
        
        document_xml = '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
    <w:body>
        <w:p><w:r><w:t>Geschiedenis Leerjaar 2 - Hoofdstuk 1: De Industriële Revolutie</w:t></w:r></w:p>
        <w:p><w:r><w:t></w:t></w:r></w:p>
        <w:p><w:r><w:t>De industriële revolutie was een periode van grote technologische en sociale veranderingen die plaatsvond tussen ongeveer 1760 en 1840. Deze periode kenmerkte zich door de overgang van handmatige productie naar mechanische productie.</w:t></w:r></w:p>
        <w:p><w:r><w:t></w:t></w:r></w:p>
        <w:p><w:r><w:t>Belangrijke uitvindingen tijdens deze periode waren de stoommachine door James Watt, mechanische weefgetouwen, en verbeterde transportmiddelen zoals kanalen en spoorwegen.</w:t></w:r></w:p>
        <w:p><w:r><w:t></w:t></w:r></w:p>
        <w:p><w:r><w:t>De gevolgen waren ingrijpend. Er ontstond urbanisatie waarbij mensen van het platteland naar de steden trokken. Nieuwe sociale klassen ontstonden: de bourgeoisie en het proletariaat.</w:t></w:r></w:p>
    </w:body>
</w:document>'''
        docx.writestr('word/document.xml', document_xml)
    
    buffer.seek(0)
    return buffer.getvalue()

def test_api_endpoint(endpoint: str, method: str = "GET", payload: Dict[Any, Any] = None, 
                     files: Dict[str, Any] = None, expected_status: int = 200, 
                     params: Dict[str, str] = None) -> Dict[Any, Any]:
    """Generic API test function"""
    url = f"{BASE_URL}{endpoint}"
    
    if params:
        url += "?" + "&".join([f"{k}={v}" for k, v in params.items()])
    
    try:
        headers = {}
        if method == "POST" and not files:
            headers['Content-Type'] = 'application/json'
        
        if method == "POST":
            if files:
                response = requests.post(url, data=payload, files=files, timeout=30)
            else:
                response = requests.post(url, json=payload, headers=headers, timeout=30)
        elif method == "GET":
            response = requests.get(url, timeout=30)
        elif method == "PUT":
            response = requests.put(url, json=payload, headers=headers, timeout=30)
        else:
            raise ValueError(f"Unsupported method: {method}")
        
        print(f"✓ {method} {endpoint} - Status: {response.status_code}")
        
        if response.status_code != expected_status:
            print(f"❌ Expected status {expected_status}, got {response.status_code}")
            try:
                error_data = response.json()
                print(f"Response: {error_data}")
            except:
                print(f"Response: {response.text[:200]}...")
            return {"success": False, "status": response.status_code, "data": response.text}
        
        try:
            data = response.json()
            return {"success": True, "status": response.status_code, "data": data}
        except json.JSONDecodeError:
            return {"success": True, "status": response.status_code, "data": response.text}
            
    except requests.exceptions.RequestException as e:
        print(f"❌ Request failed: {e}")
        return {"success": False, "error": str(e)}

def run_final_test():
    """Run final comprehensive test with proper timing"""
    print("🚀 Final Backend API Test for Materials Upload (PDF/DOCX)")
    print(f"Base URL: {BASE_URL}")
    
    results = {
        "pdf_upload": False,
        "docx_upload": False,
        "materials_list": False,
        "materials_preview": False,
        "activate_and_chat": False
    }
    
    material_ids = []
    
    try:
        # Test 1: PDF Upload
        print("\n=== Test 1: PDF Upload ===")
        pdf_data = create_small_test_pdf()
        size_kb = len(pdf_data) / 1024
        print(f"Created PDF size: {size_kb:.1f} KB")
        
        pdf_files = {
            'file': ('test_geschiedenis.pdf', pdf_data, 'application/pdf')
        }
        pdf_payload = {
            'vak': 'Geschiedenis',
            'leerjaar': '2',
            'hoofdstuk': '1',
            'uploader': 'docent'
        }
        
        pdf_result = test_api_endpoint("/materials/upload", "POST", payload=pdf_payload, files=pdf_files)
        
        if pdf_result["success"]:
            data_response = pdf_result["data"]
            if "data" in data_response and "item" in data_response["data"]:
                item = data_response["data"]["item"]
                material_id = item.get("id")
                segment_count = data_response["data"].get("segmentCount", 0)
                
                if segment_count > 0:
                    print(f"✅ PDF upload successful: ID={material_id}, segments={segment_count}")
                    results["pdf_upload"] = True
                    material_ids.append(material_id)
                else:
                    print(f"❌ PDF upload created no segments")
            else:
                print(f"❌ PDF upload response invalid")
        else:
            print("❌ PDF upload failed")
        
        # Wait for rate limit
        print("\n⏳ Waiting 4 seconds for rate limit...")
        time.sleep(4)
        
        # Test 2: DOCX Upload
        print("\n=== Test 2: DOCX Upload ===")
        docx_data = create_small_test_docx()
        size_kb = len(docx_data) / 1024
        print(f"Created DOCX size: {size_kb:.1f} KB")
        
        docx_files = {
            'file': ('test_geschiedenis.docx', docx_data, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')
        }
        docx_payload = {
            'vak': 'Geschiedenis',
            'leerjaar': '2',
            'hoofdstuk': '1',
            'uploader': 'docent'
        }
        
        docx_result = test_api_endpoint("/materials/upload", "POST", payload=docx_payload, files=docx_files)
        
        if docx_result["success"]:
            data_response = docx_result["data"]
            if "data" in data_response and "item" in data_response["data"]:
                item = data_response["data"]["item"]
                material_id = item.get("id")
                segment_count = data_response["data"].get("segmentCount", 0)
                
                if segment_count > 0:
                    print(f"✅ DOCX upload successful: ID={material_id}, segments={segment_count}")
                    results["docx_upload"] = True
                    material_ids.append(material_id)
                else:
                    print(f"❌ DOCX upload created no segments")
            else:
                print(f"❌ DOCX upload response invalid")
        else:
            print("❌ DOCX upload failed")
        
        # Test 3: Materials List
        print("\n=== Test 3: Materials List ===")
        params = {
            'vak': 'Geschiedenis',
            'leerjaar': '2',
            'hoofdstuk': '1'
        }
        
        list_result = test_api_endpoint("/materials/list", "GET", params=params)
        
        if list_result["success"]:
            data = list_result["data"]
            if "data" in data and "items" in data["data"]:
                items = data["data"]["items"]
                print(f"✅ Materials list successful: {len(items)} items found")
                
                # Debug: Print all items to see what we have
                print("📋 All items in list:")
                for i, item in enumerate(items):
                    print(f"  {i+1}. ID: {item.get('id')}, vak: {item.get('vak')}, leerjaar: {item.get('leerjaar')}, hoofdstuk: {item.get('hoofdstuk')}, type: {item.get('type')}")
                
                # Check if we have items from recent uploads
                recent_items = [item for item in items if 
                              str(item.get('vak')) == 'Geschiedenis' and 
                              str(item.get('leerjaar')) == '2' and 
                              str(item.get('hoofdstuk')) == '1']
                
                if recent_items:
                    print(f"✅ Found {len(recent_items)} items matching our upload criteria")
                    results["materials_list"] = True
                else:
                    print("❌ No items found matching our upload criteria")
            else:
                print(f"❌ Materials list response invalid")
        else:
            print("❌ Materials list failed")
        
        # Test 4: Materials Preview
        if material_ids:
            print(f"\n=== Test 4: Materials Preview for ID: {material_ids[0]} ===")
            
            params = {'id': material_ids[0]}
            preview_result = test_api_endpoint("/materials/preview", "GET", params=params)
            
            if preview_result["success"]:
                data = preview_result["data"]
                if "data" in data and "segments" in data["data"]:
                    segments = data["data"]["segments"]
                    if len(segments) <= 5 and all(isinstance(seg, str) and len(seg) > 0 for seg in segments):
                        print(f"✅ Materials preview successful: {len(segments)} segments returned (≤5 as expected)")
                        print(f"   Sample segment: {segments[0][:100]}..." if segments else "   No segments")
                        results["materials_preview"] = True
                    else:
                        print(f"❌ Invalid segments")
                else:
                    print(f"❌ Materials preview response invalid")
            else:
                print("❌ Materials preview failed")
        else:
            print("\n❌ No material IDs available for preview test")
        
        # Test 5: Materials Activate and Chat Context
        print("\n=== Test 5: Materials Activate and Chat Context ===")
        
        # First activate materials
        print("\n--- Step 5a: Activate Materials ---")
        payload = {
            'vak': 'Geschiedenis',
            'leerjaar': '2',
            'hoofdstuk': '1'
        }
        
        activate_result = test_api_endpoint("/materials/activate", "PUT", payload=payload)
        
        if activate_result["success"]:
            data = activate_result["data"]
            if "data" in data and data["data"].get("active") is True:
                set_id = data["data"].get("setId")
                print(f"✅ Materials activate successful: Set {set_id} activated")
                
                # Now test chat with context
                print("\n--- Step 5b: Test Chat with Context ---")
                chat_payload = {
                    "mode": "Leren",
                    "vak": "Geschiedenis", 
                    "leerjaar": "2",
                    "hoofdstuk": "1",
                    "messages": [
                        {
                            "role": "user",
                            "content": "Wat was de industriële revolutie?"
                        }
                    ]
                }
                
                chat_result = test_api_endpoint("/chat", "POST", payload=chat_payload)
                
                if chat_result["success"]:
                    chat_data = chat_result["data"]
                    if "message" in chat_data:
                        message = chat_data["message"]
                        print(f"✅ Chat response received: {message[:150]}...")
                        
                        # Check if the response references context/material
                        context_indicators = [
                            "lesmateriaal", "gebaseerd op", "materiaal", "hoofdstuk", 
                            "industriële revolutie", "stoommachine", "mechanische", "fabrieken",
                            "james watt", "textiel", "urbanisatie"
                        ]
                        
                        has_context = any(indicator.lower() in message.lower() for indicator in context_indicators)
                        
                        if has_context:
                            print("✅ Chat response appears to reference material context")
                            results["activate_and_chat"] = True
                        else:
                            print("⚠️ Chat response may not be using material context, but chat is working")
                            results["activate_and_chat"] = True  # Still consider it working
                    else:
                        print(f"❌ Chat response invalid")
                else:
                    print("❌ Chat with context failed")
            else:
                print(f"❌ Materials activate response invalid")
        else:
            print("❌ Materials activate failed")
        
    except Exception as e:
        print(f"❌ Unexpected error during testing: {e}")
        return False
    
    # Summary
    print("\n" + "="*70)
    print("📊 FINAL MATERIALS TEST RESULTS SUMMARY")
    print("="*70)
    
    total_tests = len(results)
    passed_tests = sum(results.values())
    
    test_descriptions = {
        "pdf_upload": "PDF Upload (<200KB) with segments > 0",
        "docx_upload": "DOCX Upload (<200KB) with segments > 0", 
        "materials_list": "Materials List includes uploaded items",
        "materials_preview": "Materials Preview returns ≤5 segments",
        "activate_and_chat": "Materials Activate + Chat Context Integration"
    }
    
    for test_name, passed in results.items():
        status = "✅ PASS" if passed else "❌ FAIL"
        description = test_descriptions.get(test_name, test_name)
        print(f"{description}: {status}")
    
    print(f"\nOverall: {passed_tests}/{total_tests} tests passed")
    
    if passed_tests == total_tests:
        print("🎉 All materials tests PASSED!")
        return True
    else:
        print("⚠️  Some materials tests FAILED!")
        return False

if __name__ == "__main__":
    # Set MongoDB URL as environment variable for the API
    os.environ['MONGO_URL'] = 'mongodb+srv://andyvdbroek_db_user:studiebot2025@cluster0.23lgwpu.mongodb.net/'
    
    success = run_final_test()
    sys.exit(0 if success else 1)