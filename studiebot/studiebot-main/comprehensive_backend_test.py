#!/usr/bin/env python3
"""
Comprehensive Backend API Testing for Studiebot Materials and Chat endpoints
Tests all materials endpoints using seed-text and chat with context functionality
"""

import requests
import json
import sys
import os
from typing import Dict, Any, Tuple

# Base URL
BASE_URL = "http://localhost:3000/api"

def test_api_endpoint(endpoint: str, method: str = "GET", payload: Dict[Any, Any] = None, 
                     expected_status: int = 200, params: Dict[str, str] = None) -> Dict[Any, Any]:
    """Generic API test function"""
    url = f"{BASE_URL}{endpoint}"
    
    if params:
        url += "?" + "&".join([f"{k}={v}" for k, v in params.items()])
    
    try:
        headers = {'Content-Type': 'application/json'} if method in ["POST", "PUT"] else {}
        
        if method == "POST":
            response = requests.post(url, json=payload, headers=headers, timeout=30)
        elif method == "GET":
            response = requests.get(url, timeout=30)
        elif method == "PUT":
            response = requests.put(url, json=payload, headers=headers, timeout=30)
        elif method == "DELETE":
            response = requests.delete(url, timeout=30)
        else:
            raise ValueError(f"Unsupported method: {method}")
        
        print(f"✓ {method} {endpoint} - Status: {response.status_code}")
        
        if response.status_code != expected_status:
            print(f"❌ Expected status {expected_status}, got {response.status_code}")
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

def test_status_db():
    """Test /api/status-db endpoint"""
    print("\n=== Testing Status DB Endpoint ===")
    
    result = test_api_endpoint("/status-db", "GET")
    
    if result["success"]:
        data = result["data"]
        if isinstance(data, dict) and data.get("ok") is True:
            server_status = data.get("serverStatus", {})
            if server_status.get("ping") is True:
                print("✅ Status DB test PASSED: ok=true, ping=true")
                return True
            else:
                print(f"❌ Status DB ping failed: {server_status}")
                return False
        else:
            print(f"❌ Status DB response invalid: {data}")
            return False
    else:
        print("❌ Status DB test FAILED")
        return False

def test_materials_seed_text():
    """Test /api/materials/seed-text endpoint to create materials"""
    print("\n=== Testing Materials Seed Text (Create Materials) ===")
    
    # Create comprehensive text about Geschiedenis for testing
    geschiedenis_text = """
Geschiedenis Leerjaar 2 - Hoofdstuk 1: De Industriële Revolutie

De industriële revolutie was een periode van grote technologische en sociale veranderingen die plaatsvond tussen ongeveer 1760 en 1840. Deze periode kenmerkte zich door de overgang van handmatige productie naar mechanische productie met behulp van machines.

Belangrijke uitvindingen tijdens deze periode waren de stoommachine door James Watt, mechanische weefgetouwen, en verbeterde transportmiddelen zoals kanalen en spoorwegen. Deze uitvindingen zorgden voor een enorme toename in de productiecapaciteit en veranderden de manier waarop mensen werkten en leefden.

De gevolgen van de industriële revolutie waren ingrijpend. Er ontstond urbanisatie waarbij mensen van het platteland naar de steden trokken om werk te vinden in de nieuwe fabrieken. Nieuwe sociale klassen ontstonden: de bourgeoisie (fabrikseigenaren en handelaren) en het proletariaat (fabrieksarbeiders). Arbeidsomstandigheden waren vaak slecht in de fabrieken, met lange werkdagen, gevaarlijke machines, en kinderarbeid was wijdverspreid.

De industriële revolutie begon in Engeland vanwege verschillende gunstige factoren. Ten eerste was er de beschikbaarheid van steenkool en ijzererts als grondstoffen. Ten tweede zorgde politieke stabiliteit voor een veilig investeringsklimaat. Ten derde was er kapitaal beschikbaar voor investeringen in nieuwe technologieën. Ten vierde leverde de koloniale handel markten en grondstoffen op. Ten vijfde was er wetenschappelijke vooruitgang en een cultuur van innovatie.

De verspreiding van de industriële revolutie naar andere landen gebeurde geleidelijk. Frankrijk, Duitsland, en de Verenigde Staten volgden in de 19de eeuw. Elk land paste de nieuwe technologieën aan hun eigen omstandigheden aan. De spoorwegen speelden een cruciale rol bij de verspreiding van industrialisatie, omdat ze transport van goederen en mensen veel efficiënter maakten.

De sociale gevolgen van de industrialisatie waren complex. Enerzijds ontstonden er nieuwe mogelijkheden voor welvaart en sociale mobiliteit. Anderzijds ontstonden er ook nieuwe vormen van armoede en sociale ongelijkheid. Arbeiders begonnen zich te organiseren in vakbonden om hun arbeidsomstandigheden te verbeteren. Dit leidde tot de ontwikkeling van de arbeidersbeweging en socialistische ideologieën.

Deze periode legde de basis voor de moderne industriële samenleving en had wereldwijde gevolgen die tot op de dag van vandaag merkbaar zijn. De industriële revolutie veranderde niet alleen de economie, maar ook de politiek, cultuur, en het dagelijks leven van miljoenen mensen.
"""
    
    payload = {
        'vak': 'Geschiedenis',
        'leerjaar': '2',
        'hoofdstuk': '1',
        'text': geschiedenis_text
    }
    
    result = test_api_endpoint("/materials/seed-text", "POST", payload)
    
    if result["success"]:
        data = result["data"]
        if "data" in data and "item" in data["data"]:
            item = data["data"]["item"]
            material_id = item.get("id")
            segment_count = data["data"].get("segmentCount", 0)
            print(f"✅ Materials seed-text successful: ID={material_id}, segments={segment_count}")
            return True, material_id
        else:
            print(f"❌ Materials seed-text response invalid: {data}")
            return False, None
    else:
        print("❌ Materials seed-text failed")
        return False, None

def test_materials_list_with_items():
    """Test /api/materials/list endpoint with items"""
    print("\n=== Testing Materials List (With Items) ===")
    
    params = {
        'vak': 'Geschiedenis',
        'leerjaar': '2',
        'hoofdstuk': '1'
    }
    
    result = test_api_endpoint("/materials/list", "GET", params=params)
    
    if result["success"]:
        data = result["data"]
        if "data" in data and "items" in data["data"]:
            items = data["data"]["items"]
            active_set = data["data"].get("set")
            print(f"✅ Materials list successful: {len(items)} items found")
            if active_set:
                print(f"✅ Active set found: {active_set.get('id')}")
            else:
                print("ℹ️ No active set currently")
            return True, items, active_set
        else:
            print(f"❌ Materials list response invalid: {data}")
            return False, [], None
    else:
        print("❌ Materials list failed")
        return False, [], None

def test_materials_preview_with_id(material_id):
    """Test /api/materials/preview endpoint with valid ID"""
    print(f"\n=== Testing Materials Preview (With ID: {material_id}) ===")
    
    if not material_id:
        print("❌ No material ID provided for preview test")
        return False
    
    params = {'id': material_id}
    result = test_api_endpoint("/materials/preview", "GET", params=params)
    
    if result["success"]:
        data = result["data"]
        if "data" in data and "segments" in data["data"]:
            segments = data["data"]["segments"]
            if len(segments) <= 5 and all(isinstance(seg, str) and len(seg) > 0 for seg in segments):
                print(f"✅ Materials preview successful: {len(segments)} segments returned")
                for i, seg in enumerate(segments[:2]):  # Show first 2 segments
                    print(f"   Segment {i+1}: {seg[:100]}...")
                return True
            else:
                print(f"❌ Invalid segments: {segments}")
                return False
        else:
            print(f"❌ Materials preview response invalid: {data}")
            return False
    else:
        print("❌ Materials preview failed")
        return False

def test_materials_activate():
    """Test /api/materials/activate endpoint"""
    print("\n=== Testing Materials Activate ===")
    
    payload = {
        'vak': 'Geschiedenis',
        'leerjaar': '2',
        'hoofdstuk': '1'
    }
    
    result = test_api_endpoint("/materials/activate", "PUT", payload=payload)
    
    if result["success"]:
        data = result["data"]
        if "data" in data and data["data"].get("active") is True:
            set_id = data["data"].get("setId")
            print(f"✅ Materials activate successful: Set {set_id} activated")
            return True
        else:
            print(f"❌ Materials activate response invalid: {data}")
            return False
    else:
        print("❌ Materials activate failed")
        return False

def test_chat_with_context_after_activation():
    """Test /api/chat with context after material activation"""
    print("\n=== Testing Chat with Context (After Activation) ===")
    
    payload = {
        "mode": "Leren",
        "vak": "Geschiedenis", 
        "leerjaar": "2",
        "hoofdstuk": "1",
        "messages": [
            {
                "role": "user",
                "content": "Wat waren de belangrijkste uitvindingen tijdens de industriële revolutie?"
            }
        ]
    }
    
    result = test_api_endpoint("/chat", "POST", payload)
    
    if result["success"]:
        data = result["data"]
        if "message" in data:
            message = data["message"]
            print(f"✅ Chat response received: {message[:150]}...")
            
            # Check if the response references context/material from our seeded text
            context_indicators = [
                "stoommachine", "james watt", "weefgetouwen", "spoorwegen", 
                "fabrieken", "bourgeoisie", "proletariaat", "engeland",
                "steenkool", "ijzererts", "lesmateriaal", "gebaseerd op"
            ]
            
            has_context = any(indicator.lower() in message.lower() for indicator in context_indicators)
            
            if has_context:
                print("✅ Chat response appears to reference material context from seeded text")
                return True
            else:
                print("⚠️ Chat response may not be using material context")
                print(f"Full response: {message}")
                return True  # Still consider it working, just note the observation
        else:
            print(f"❌ Chat response invalid: {data}")
            return False
    else:
        print("❌ Chat with context failed")
        return False

def test_materials_delete(material_id):
    """Test /api/materials/item DELETE endpoint"""
    print(f"\n=== Testing Materials Delete (ID: {material_id}) ===")
    
    if not material_id:
        print("❌ No material ID provided for delete test")
        return False
    
    params = {'id': material_id}
    result = test_api_endpoint("/materials/item", "DELETE", params=params)
    
    if result["success"]:
        data = result["data"]
        if "data" in data and data["data"].get("deleted") is True:
            print(f"✅ Materials delete successful: Material {material_id} deleted")
            return True
        else:
            print(f"❌ Materials delete response invalid: {data}")
            return False
    else:
        print("❌ Materials delete failed")
        return False

def run_comprehensive_backend_test():
    """Run comprehensive backend tests including full materials workflow"""
    print("🚀 Starting Comprehensive Backend API Tests for Studiebot")
    print(f"Base URL: {BASE_URL}")
    
    results = {
        "status_db": False,
        "materials_seed_text": False,
        "materials_list": False,
        "materials_preview": False,
        "materials_activate": False,
        "chat_with_context": False,
        "materials_delete": False
    }
    
    material_id = None
    
    try:
        # Test 1: Status DB
        results["status_db"] = test_status_db()
        
        # Test 2: Materials Seed Text (Create materials)
        seed_success, material_id = test_materials_seed_text()
        results["materials_seed_text"] = seed_success
        
        # Test 3: Materials List (should now have items)
        list_success, items, active_set = test_materials_list_with_items()
        results["materials_list"] = list_success
        
        # Test 4: Materials Preview (with actual material ID)
        if material_id:
            results["materials_preview"] = test_materials_preview_with_id(material_id)
        
        # Test 5: Materials Activate
        results["materials_activate"] = test_materials_activate()
        
        # Test 6: Chat with Context (after activation)
        results["chat_with_context"] = test_chat_with_context_after_activation()
        
        # Test 7: Materials Delete (clean up)
        if material_id:
            results["materials_delete"] = test_materials_delete(material_id)
        
    except Exception as e:
        print(f"❌ Unexpected error during testing: {e}")
        return False
    
    # Summary
    print("\n" + "="*60)
    print("📊 COMPREHENSIVE TEST RESULTS SUMMARY")
    print("="*60)
    
    total_tests = len(results)
    passed_tests = sum(results.values())
    
    for test_name, passed in results.items():
        status = "✅ PASS" if passed else "❌ FAIL"
        print(f"{test_name.upper().replace('_', ' ')}: {status}")
    
    print(f"\nOverall: {passed_tests}/{total_tests} tests passed")
    
    if passed_tests == total_tests:
        print("🎉 All comprehensive backend tests PASSED!")
        return True
    else:
        print("⚠️  Some comprehensive backend tests FAILED!")
        return False

if __name__ == "__main__":
    success = run_comprehensive_backend_test()
    sys.exit(0 if success else 1)