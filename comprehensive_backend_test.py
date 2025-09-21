#!/usr/bin/env python3
"""
Backend tests focused on three areas as per review request:

A) Build fix verification (Next.js compiles): Sanity check by attempting to load the root page and verify no syntax errors at app/page.jsx. Also verify that NEXT_PUBLIC_UI_DEBUG toggles logs: set to true and ensure console logs appear minimal.

B) Materials – Preview & Delete:
1. Seed a dummy material record in MongoDB if none exists: materials(material_id: 'mat_demo', filename:'demo.pdf', type:'pdf', size: 12345, segments:1, active:false, createdAt: now) and material_segments(material_id:'mat_demo', text:'Dit is een voorbeeldsegment over de geschiedenis van Nederland.', created_at: now). Ensure GridFS optional.
2. GET /api/materials/preview?material_id=mat_demo
3. GET /api/materials/mat_demo/preview (alias route)
4. DELETE via alias: DELETE /api/materials/item?id=mat_demo
5. DELETE via param route: DELETE /api/materials/mat_demo
6. POST /api/materials/delete with { material_id: 'mat_demo' }

C) LLM routes must use active material context
1. Seed an active material: materials(material_id:'mat_active', filename:'act.pdf', type:'pdf', size:23456, segments:2, subject:'Geschiedenis', grade:2, chapter:1, active:true, createdAt: now) and material_segments for mat_active with 2 segments of Dutch text mentioning a unique term like "Tachtigjarige Oorlog".
2. POST /api/llm/generate-hints with { topicId:'Geschiedenis-1', text:'Leg uit wat de Tachtigjarige Oorlog was', subject:'Geschiedenis', grade:2, chapter:1 }
3. POST /api/llm/quiz/generate-question with { topicId:'Geschiedenis-1', subject:'Geschiedenis', grade:2, chapter:1 }
4. POST /api/llm/exam/generate with { topicId:'Geschiedenis-1', subject:'Geschiedenis', grade:2, chapter:1, totalQuestions:5 }
5. POST /api/llm/generate-hints with mismatched context { subject:'Engels', grade:3, chapter:1 }

Ensure every response has Content-Type: application/json and that there are no "Unexpected end of JSON input" errors anywhere.
"""

import requests
import json
import sys
import os
from typing import Dict, Any, List
from datetime import datetime
from pymongo import MongoClient
import uuid

# Base URL for the Next.js server (local)
BASE_URL = "http://localhost:3000"

# MongoDB connection
MONGO_URL = "mongodb://localhost:27017/studiebot"

class StudiebotBackendTester:
    def __init__(self):
        self.results = []
        self.failed_tests = []
        self.mongo_client = None
        self.db = None
        
    def setup_mongodb(self):
        """Setup MongoDB connection"""
        try:
            self.mongo_client = MongoClient(MONGO_URL)
            self.db = self.mongo_client.studiebot
            # Test connection
            self.mongo_client.admin.command('ping')
            print("✅ MongoDB connection established")
            return True
        except Exception as e:
            print(f"❌ MongoDB connection failed: {e}")
            return False
        
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
    
    def validate_json_response(self, response, test_name: str, expected_fields: List[str] = None) -> bool:
        """Validate that response is JSON with required fields"""
        try:
            # Check Content-Type header
            content_type = response.headers.get('content-type', '')
            if 'application/json' not in content_type:
                self.log_result(test_name, False, f"Wrong Content-Type: {content_type}, expected application/json")
                return False
            
            # Parse JSON
            data = response.json()
            
            # Check required fields if specified
            if expected_fields:
                missing_fields = []
                for field in expected_fields:
                    if field not in data:
                        missing_fields.append(field)
                
                if missing_fields:
                    self.log_result(test_name, False, f"Missing fields: {missing_fields}")
                    return False
            
            return True
            
        except json.JSONDecodeError as e:
            self.log_result(test_name, False, f"Invalid JSON response: {str(e)}")
            return False
        except Exception as e:
            self.log_result(test_name, False, f"Response validation error: {str(e)}")
            return False

    def test_build_verification(self):
        """A) Build fix verification - load root page and check for syntax errors"""
        test_name = "Build Verification - Root Page Load"
        
        try:
            response = requests.get(f"{BASE_URL}/", timeout=30)
            
            if response.status_code != 200:
                self.log_result(test_name, False, f"Expected 200, got {response.status_code}")
                return
            
            # Check if page loads without syntax errors (should contain basic HTML structure)
            content = response.text
            if "<!DOCTYPE html>" in content or "<html" in content:
                self.log_result(test_name, True, "Root page loads successfully")
            else:
                self.log_result(test_name, False, "Root page doesn't contain valid HTML structure")
                
        except requests.exceptions.RequestException as e:
            self.log_result(test_name, False, f"Request failed: {str(e)}")
        except Exception as e:
            self.log_result(test_name, False, f"Unexpected error: {str(e)}")

    def seed_demo_material(self):
        """Seed dummy material record for testing"""
        if self.db is None:
            return False
            
        try:
            # Insert demo material
            material_doc = {
                "material_id": "mat_demo",
                "filename": "demo.pdf",
                "type": "pdf",
                "size": 12345,
                "segments": 1,
                "active": False,
                "createdAt": datetime.now()
            }
            
            # Remove existing demo material first
            self.db.materials.delete_many({"material_id": "mat_demo"})
            self.db.material_segments.delete_many({"material_id": "mat_demo"})
            
            # Insert new demo material
            self.db.materials.insert_one(material_doc)
            
            # Insert demo segment
            segment_doc = {
                "material_id": "mat_demo",
                "text": "Dit is een voorbeeldsegment over de geschiedenis van Nederland.",
                "created_at": datetime.now()
            }
            self.db.material_segments.insert_one(segment_doc)
            
            print("✅ Demo material seeded successfully")
            return True
            
        except Exception as e:
            print(f"❌ Failed to seed demo material: {e}")
            return False

    def seed_active_material(self):
        """Seed active material for LLM context testing"""
        if not self.db:
            return False
            
        try:
            # Insert active material
            material_doc = {
                "material_id": "mat_active",
                "filename": "act.pdf",
                "type": "pdf",
                "size": 23456,
                "segments": 2,
                "subject": "Geschiedenis",
                "grade": 2,
                "chapter": 1,
                "active": True,
                "createdAt": datetime.now()
            }
            
            # Remove existing active material first
            self.db.materials.delete_many({"material_id": "mat_active"})
            self.db.material_segments.delete_many({"material_id": "mat_active"})
            
            # Insert new active material
            self.db.materials.insert_one(material_doc)
            
            # Insert segments with Dutch text mentioning "Tachtigjarige Oorlog"
            segments = [
                {
                    "material_id": "mat_active",
                    "text": "De Tachtigjarige Oorlog (1566-1648) was een opstand van de Nederlandse gewesten tegen de Spaanse overheersing. Deze oorlog leidde uiteindelijk tot de onafhankelijkheid van de Republiek der Zeven Verenigde Nederlanden.",
                    "created_at": datetime.now()
                },
                {
                    "material_id": "mat_active", 
                    "text": "Tijdens de Tachtigjarige Oorlog speelden figuren zoals Willem van Oranje een belangrijke rol in de Nederlandse opstand tegen Spanje. De oorlog had grote gevolgen voor de politieke en religieuze situatie in de Lage Landen.",
                    "created_at": datetime.now()
                }
            ]
            
            self.db.material_segments.insert_many(segments)
            
            print("✅ Active material seeded successfully")
            return True
            
        except Exception as e:
            print(f"❌ Failed to seed active material: {e}")
            return False

    def test_materials_preview_query(self):
        """B.2) GET /api/materials/preview?material_id=mat_demo"""
        test_name = "Materials Preview (Query Param)"
        url = f"{BASE_URL}/api/materials/preview?material_id=mat_demo"
        
        try:
            response = requests.get(url, timeout=30)
            
            if response.status_code != 200:
                self.log_result(test_name, False, f"Expected 200, got {response.status_code}")
                return
            
            if not self.validate_json_response(response, test_name):
                return
            
            data = response.json()
            
            # Check expected structure
            expected_structure = {
                'ok': True,
                'material': {'id': 'mat_demo', 'filename': 'demo.pdf', 'type': 'pdf', 'size': 12345},
                'preview': {'textSnippet': str, 'firstPage': 1}
            }
            
            if not data.get('ok'):
                self.log_result(test_name, False, f"Expected ok=true, got ok={data.get('ok')}")
                return
            
            if 'material' not in data or 'preview' not in data:
                self.log_result(test_name, False, f"Missing material or preview in response")
                return
            
            # Check X-Debug header
            debug_header = response.headers.get('X-Debug', '')
            expected_debug = ['materials:preview|ok', 'materials:preview|stub']
            if not any(exp in debug_header for exp in expected_debug):
                self.log_result(test_name, False, f"Expected X-Debug header with materials:preview, got: {debug_header}")
                return
            
            self.log_result(test_name, True, f"Preview returned successfully, X-Debug: {debug_header}")
            
        except requests.exceptions.RequestException as e:
            self.log_result(test_name, False, f"Request failed: {str(e)}")
        except Exception as e:
            self.log_result(test_name, False, f"Unexpected error: {str(e)}")

    def test_materials_preview_alias(self):
        """B.3) GET /api/materials/mat_demo/preview (alias route)"""
        test_name = "Materials Preview (Alias Route)"
        url = f"{BASE_URL}/api/materials/mat_demo/preview"
        
        try:
            response = requests.get(url, timeout=30)
            
            if response.status_code != 200:
                self.log_result(test_name, False, f"Expected 200, got {response.status_code}")
                return
            
            if not self.validate_json_response(response, test_name):
                return
            
            data = response.json()
            
            if not data.get('ok'):
                self.log_result(test_name, False, f"Expected ok=true, got ok={data.get('ok')}")
                return
            
            if 'material' not in data or 'preview' not in data:
                self.log_result(test_name, False, f"Missing material or preview in response")
                return
            
            self.log_result(test_name, True, "Alias preview route works correctly")
            
        except requests.exceptions.RequestException as e:
            self.log_result(test_name, False, f"Request failed: {str(e)}")
        except Exception as e:
            self.log_result(test_name, False, f"Unexpected error: {str(e)}")

    def test_materials_delete_alias(self):
        """B.4) DELETE via alias: DELETE /api/materials/item?id=mat_demo"""
        test_name = "Materials Delete (Alias)"
        url = f"{BASE_URL}/api/materials/item?id=mat_demo"
        
        try:
            response = requests.delete(url, timeout=30)
            
            if response.status_code != 200:
                self.log_result(test_name, False, f"Expected 200, got {response.status_code}")
                return
            
            if not self.validate_json_response(response, test_name):
                return
            
            data = response.json()
            
            if not data.get('ok'):
                self.log_result(test_name, False, f"Expected ok=true, got ok={data.get('ok')}")
                return
            
            if 'deleted' not in data:
                self.log_result(test_name, False, f"Missing 'deleted' field in response")
                return
            
            deleted = data['deleted']
            if 'materials' not in deleted or 'segments' not in deleted:
                self.log_result(test_name, False, f"Missing materials/segments count in deleted field")
                return
            
            # Check X-Debug header
            debug_header = response.headers.get('X-Debug', '')
            if 'materials:delete|ok' not in debug_header:
                self.log_result(test_name, False, f"Expected X-Debug header with materials:delete|ok, got: {debug_header}")
                return
            
            self.log_result(test_name, True, f"Delete successful: {deleted}, X-Debug: {debug_header}")
            
        except requests.exceptions.RequestException as e:
            self.log_result(test_name, False, f"Request failed: {str(e)}")
        except Exception as e:
            self.log_result(test_name, False, f"Unexpected error: {str(e)}")

    def test_materials_delete_param_404(self):
        """B.5) DELETE via param route: DELETE /api/materials/mat_demo (should be 404 after deletion)"""
        test_name = "Materials Delete Param (404 Expected)"
        url = f"{BASE_URL}/api/materials/mat_demo"
        
        try:
            response = requests.delete(url, timeout=30)
            
            if response.status_code != 404:
                self.log_result(test_name, False, f"Expected 404, got {response.status_code}")
                return
            
            if not self.validate_json_response(response, test_name):
                return
            
            data = response.json()
            
            if data.get('ok') != False:
                self.log_result(test_name, False, f"Expected ok=false, got ok={data.get('ok')}")
                return
            
            self.log_result(test_name, True, "404 returned correctly for already deleted material")
            
        except requests.exceptions.RequestException as e:
            self.log_result(test_name, False, f"Request failed: {str(e)}")
        except Exception as e:
            self.log_result(test_name, False, f"Unexpected error: {str(e)}")

    def test_materials_delete_post_404(self):
        """B.6) POST /api/materials/delete with { material_id: 'mat_demo' } (should be 404)"""
        test_name = "Materials Delete POST (404 Expected)"
        url = f"{BASE_URL}/api/materials/delete"
        payload = {"material_id": "mat_demo"}
        
        try:
            response = requests.post(url, json=payload, timeout=30)
            
            if response.status_code != 404:
                self.log_result(test_name, False, f"Expected 404, got {response.status_code}")
                return
            
            if not self.validate_json_response(response, test_name):
                return
            
            data = response.json()
            
            if data.get('ok') != False:
                self.log_result(test_name, False, f"Expected ok=false, got ok={data.get('ok')}")
                return
            
            self.log_result(test_name, True, "404 returned correctly for POST delete of non-existent material")
            
        except requests.exceptions.RequestException as e:
            self.log_result(test_name, False, f"Request failed: {str(e)}")
        except Exception as e:
            self.log_result(test_name, False, f"Unexpected error: {str(e)}")

    def test_llm_generate_hints_with_context(self):
        """C.2) POST /api/llm/generate-hints with active material context"""
        test_name = "LLM Generate Hints (With Context)"
        url = f"{BASE_URL}/api/llm/generate-hints"
        payload = {
            "topicId": "Geschiedenis-1",
            "text": "Leg uit wat de Tachtigjarige Oorlog was",
            "subject": "Geschiedenis",
            "grade": 2,
            "chapter": 1
        }
        
        try:
            response = requests.post(url, json=payload, timeout=30)
            
            if response.status_code != 200:
                self.log_result(test_name, False, f"Expected 200, got {response.status_code}")
                return
            
            if not self.validate_json_response(response, test_name, ['ok']):
                return
            
            data = response.json()
            
            if not data.get('ok'):
                self.log_result(test_name, False, f"Expected ok=true, got ok={data.get('ok')}")
                return
            
            # Check required fields
            required_fields = ['tutor_message', 'hints', 'follow_up_question']
            missing_fields = [f for f in required_fields if f not in data]
            if missing_fields:
                self.log_result(test_name, False, f"Missing required fields: {missing_fields}")
                return
            
            # Check X-Debug header for material usage
            debug_header = response.headers.get('X-Debug', '')
            if 'llm:learn|used_material' not in debug_header:
                self.log_result(test_name, False, f"Expected X-Debug with used_material, got: {debug_header}")
                return
            
            # Check X-Studiebot-LLM header
            llm_header = response.headers.get('X-Studiebot-LLM', '')
            
            # Check no_material field should be false
            if data.get('no_material') != False:
                self.log_result(test_name, False, f"Expected no_material=false, got no_material={data.get('no_material')}")
                return
            
            self.log_result(test_name, True, f"LLM hints generated with material context, X-Debug: {debug_header}, LLM: {llm_header}")
            
        except requests.exceptions.RequestException as e:
            self.log_result(test_name, False, f"Request failed: {str(e)}")
        except Exception as e:
            self.log_result(test_name, False, f"Unexpected error: {str(e)}")

    def test_llm_quiz_generate_with_context(self):
        """C.3) POST /api/llm/quiz/generate-question with active material context"""
        test_name = "LLM Quiz Generate (With Context)"
        url = f"{BASE_URL}/api/llm/quiz/generate-question"
        payload = {
            "topicId": "Geschiedenis-1",
            "subject": "Geschiedenis",
            "grade": 2,
            "chapter": 1
        }
        
        try:
            response = requests.post(url, json=payload, timeout=30)
            
            if response.status_code != 200:
                self.log_result(test_name, False, f"Expected 200, got {response.status_code}")
                return
            
            if not self.validate_json_response(response, test_name, ['ok']):
                return
            
            data = response.json()
            
            if not data.get('ok'):
                self.log_result(test_name, False, f"Expected ok=true, got ok={data.get('ok')}")
                return
            
            # Check X-Debug header for material usage
            debug_header = response.headers.get('X-Debug', '')
            if 'llm:quiz|used_material' not in debug_header:
                self.log_result(test_name, False, f"Expected X-Debug with used_material, got: {debug_header}")
                return
            
            self.log_result(test_name, True, f"Quiz question generated with material context, X-Debug: {debug_header}")
            
        except requests.exceptions.RequestException as e:
            self.log_result(test_name, False, f"Request failed: {str(e)}")
        except Exception as e:
            self.log_result(test_name, False, f"Unexpected error: {str(e)}")

    def test_llm_exam_generate_with_context(self):
        """C.4) POST /api/llm/exam/generate with active material context"""
        test_name = "LLM Exam Generate (With Context)"
        url = f"{BASE_URL}/api/llm/exam/generate"
        payload = {
            "topicId": "Geschiedenis-1",
            "subject": "Geschiedenis",
            "grade": 2,
            "chapter": 1,
            "totalQuestions": 5
        }
        
        try:
            response = requests.post(url, json=payload, timeout=30)
            
            if response.status_code != 200:
                self.log_result(test_name, False, f"Expected 200, got {response.status_code}")
                return
            
            if not self.validate_json_response(response, test_name, ['ok']):
                return
            
            data = response.json()
            
            if not data.get('ok'):
                self.log_result(test_name, False, f"Expected ok=true, got ok={data.get('ok')}")
                return
            
            # Check for exam_id and items
            if 'exam_id' not in data:
                self.log_result(test_name, False, "Missing exam_id in response")
                return
            
            if 'items' not in data:
                self.log_result(test_name, False, "Missing items array in response")
                return
            
            # Check X-Debug header for material usage
            debug_header = response.headers.get('X-Debug', '')
            if 'llm:exam|used_material' not in debug_header:
                self.log_result(test_name, False, f"Expected X-Debug with used_material, got: {debug_header}")
                return
            
            self.log_result(test_name, True, f"Exam generated with material context, exam_id: {data.get('exam_id')}, X-Debug: {debug_header}")
            
        except requests.exceptions.RequestException as e:
            self.log_result(test_name, False, f"Request failed: {str(e)}")
        except Exception as e:
            self.log_result(test_name, False, f"Unexpected error: {str(e)}")

    def test_llm_generate_hints_no_context(self):
        """C.5) POST /api/llm/generate-hints with mismatched context (should return no_material)"""
        test_name = "LLM Generate Hints (No Context)"
        url = f"{BASE_URL}/api/llm/generate-hints"
        payload = {
            "subject": "Engels",
            "grade": 3,
            "chapter": 1
        }
        
        try:
            response = requests.post(url, json=payload, timeout=30)
            
            if response.status_code != 400:
                self.log_result(test_name, False, f"Expected 400, got {response.status_code}")
                return
            
            if not self.validate_json_response(response, test_name, ['ok']):
                return
            
            data = response.json()
            
            if data.get('ok') != False:
                self.log_result(test_name, False, f"Expected ok=false, got ok={data.get('ok')}")
                return
            
            if data.get('reason') != 'no_material':
                self.log_result(test_name, False, f"Expected reason='no_material', got reason={data.get('reason')}")
                return
            
            # Check X-Debug header
            debug_header = response.headers.get('X-Debug', '')
            if 'llm:learn|no_material' not in debug_header:
                self.log_result(test_name, False, f"Expected X-Debug with no_material, got: {debug_header}")
                return
            
            self.log_result(test_name, True, f"No material context handled correctly, X-Debug: {debug_header}")
            
        except requests.exceptions.RequestException as e:
            self.log_result(test_name, False, f"Request failed: {str(e)}")
        except Exception as e:
            self.log_result(test_name, False, f"Unexpected error: {str(e)}")

    def run_all_tests(self):
        """Run all backend tests"""
        print("🚀 Starting Studiebot Backend Tests (Review Request)")
        print("=" * 80)
        print(f"Testing against: {BASE_URL}")
        print("=" * 80)
        
        # Setup MongoDB
        if not self.setup_mongodb():
            print("❌ Cannot proceed without MongoDB connection")
            return False
        
        # A) Build fix verification
        print("\n📋 A) Build Fix Verification")
        print("-" * 40)
        self.test_build_verification()
        
        # B) Materials Preview & Delete
        print("\n📋 B) Materials Preview & Delete")
        print("-" * 40)
        
        # Seed demo material
        if not self.seed_demo_material():
            print("❌ Cannot proceed with materials tests without seeding")
            return False
        
        self.test_materials_preview_query()
        self.test_materials_preview_alias()
        self.test_materials_delete_alias()
        self.test_materials_delete_param_404()
        self.test_materials_delete_post_404()
        
        # C) LLM routes with active material context
        print("\n📋 C) LLM Routes with Active Material Context")
        print("-" * 40)
        
        # Seed active material
        if not self.seed_active_material():
            print("❌ Cannot proceed with LLM tests without seeding active material")
            return False
        
        self.test_llm_generate_hints_with_context()
        self.test_llm_quiz_generate_with_context()
        self.test_llm_exam_generate_with_context()
        self.test_llm_generate_hints_no_context()
        
        # Summary
        print("\n" + "=" * 80)
        print("📊 TEST SUMMARY")
        print("=" * 80)
        
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
        
        # Cleanup
        if self.mongo_client:
            self.mongo_client.close()
        
        return failed_tests == 0

def main():
    """Main test runner"""
    tester = StudiebotBackendTester()
    success = tester.run_all_tests()
    
    # Exit with appropriate code
    sys.exit(0 if success else 1)

if __name__ == "__main__":
    main()