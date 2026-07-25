import unittest
import json
import re
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

class TestProjectsStructure(unittest.TestCase):
    def setUp(self):
        with open('projects.js', 'r', encoding='utf-8') as f:
            self.content = f.read()

    def test_project_count(self):
        defined = self.content.count("id: '")
        self.assertGreater(defined, 0)

    def test_no_progress_percent(self):
        self.assertNotIn('progressPercent', self.content)

    def test_lovebud_evidence_correct(self):
        self.assertIn('#3425 OPEN', self.content)

    def test_living_fiction_no_issue139(self):
        self.assertNotIn('#139', self.content)

    def test_living_fiction_issue140(self):
        self.assertIn('Issue #140', self.content)

    def test_ai_finder_1181_deferred(self):
        self.assertIn('#1181', self.content)
        self.assertIn('deferred', self.content)

    def test_personal_edition_pr111(self):
        self.assertIn('PR #111', self.content)

    def test_living_travel_comment(self):
        self.assertIn('5071926646', self.content)

    def test_tasks_have_evidence_field(self):
        self.assertIn('evidence', self.content)

    def test_tasks_have_done_field(self):
        self.assertIn('done:', self.content)

    def test_lovebud_tasks_six(self):
        count = self.content.count("'lb-")
        self.assertEqual(count, 6)

    def test_personal_edition_tasks_four(self):
        count = self.content.count("'pe-")
        self.assertEqual(count, 4)

    def test_living_travel_tasks_three(self):
        count = self.content.count("'lt-")
        self.assertEqual(count, 3)

    def test_ai_finder_tasks_two(self):
        count = self.content.count("'af-")
        self.assertEqual(count, 2)

    def test_has_lovebud_in_projects(self):
        self.assertIn("id: 'lovebud'", self.content)

    def test_has_living_fiction(self):
        self.assertIn("id: 'living-fiction'", self.content)

    def test_has_living_travel(self):
        self.assertIn("id: 'living-travel'", self.content)

    def test_has_ai_finder(self):
        self.assertIn("id: 'ai-finder'", self.content)

    def test_has_personal_edition(self):
        self.assertIn("id: 'personal-edition'", self.content)

    def test_has_korean_ai_platform(self):
        self.assertIn("id: 'korean-ai-platform'", self.content)

    def test_has_personal_video_archive(self):
        self.assertIn("id: 'personal-video-archive'", self.content)

    def test_has_ai_revenue_lab(self):
        self.assertIn("id: 'ai-revenue-lab'", self.content)

    def test_has_lovetree3(self):
        self.assertIn("id: 'lovetree3'", self.content)

    def test_has_lovebud_gallery(self):
        self.assertIn("id: 'lovebud-gallery'", self.content)

    def test_has_love_match_making(self):
        self.assertIn("id: 'love-match-making'", self.content)

    def test_has_music_composer(self):
        self.assertIn("id: 'music-composer'", self.content)

    def test_has_cwtree(self):
        self.assertIn("id: 'cwtree'", self.content)

    def test_undefined_has_zero_tasks(self):
        self.assertIn("tasks: {}", self.content)

    def test_lovebud_has_closed_3451(self):
        self.assertIn('3451 CLOSED', self.content)

    def test_lovebud_has_closed_3481(self):
        self.assertIn('3481 CLOSED', self.content)

    def test_lovebud_has_pr3531_commit(self):
        self.assertIn('e0ff1b2a4089c31fe4adb3e9c082ef9a4499a1cf', self.content)


class TestBusinessesStructure(unittest.TestCase):
    def setUp(self):
        with open('businesses.js', 'r', encoding='utf-8') as f:
            self.content = f.read()

    def test_businesses_defined(self):
        self.assertIn('export const businesses', self.content)

    def test_all_13_projects_in_businesses(self):
        count = self.content.count("': { name:")
        self.assertEqual(count, 13)

    def test_businesses_have_category(self):
        self.assertIn('category', self.content)

    def test_businesses_have_priority(self):
        self.assertIn('priority', self.content)

    def test_lovebud_in_businesses(self):
        self.assertIn("'lovebud': {", self.content)

    def test_cwtree_in_businesses(self):
        self.assertIn("'cwtree': {", self.content)


class TestAppStructure(unittest.TestCase):
    def setUp(self):
        with open('app.js', 'r', encoding='utf-8') as f:
            self.content = f.read()

    def test_calc_progress_function(self):
        self.assertIn('calcProgress', self.content)

    def test_no_hardcoded_progress(self):
        self.assertNotIn('progressPercent', self.content)

    def test_generates_html(self):
        self.assertIn('index.html', self.content)

    def test_imports_projects(self):
        self.assertIn('import', self.content)

    def test_imports_businesses(self):
        self.assertIn('businesses', self.content)

    def test_generates_table(self):
        self.assertIn('<table>', self.content)

    def test_generates_project_cards(self):
        self.assertIn('project-card', self.content)

    def test_generates_progress_bars(self):
        self.assertIn('progress-bar', self.content)

    def test_generates_footer(self):
        self.assertIn('footer', self.content)


class TestValidation(unittest.TestCase):
    def setUp(self):
        with open('tests/validate_projects.js', 'r', encoding='utf-8') as f:
            self.content = f.read()

    def test_uses_vm_module(self):
        self.assertIn('vm', self.content)

    def test_checks_13_projects(self):
        self.assertIn('13', self.content)

    def test_checks_9_defined(self):
        self.assertIn('9 defined', self.content) or self.assertIn('9,', self.content)


class TestHtmlOutput(unittest.TestCase):
    def setUp(self):
        if os.path.exists('index.html'):
            with open('index.html', 'r', encoding='utf-8') as f:
                self.content = f.read()
        else:
            self.content = ''

    def test_index_html_exists(self):
        self.assertTrue(len(self.content) > 0)

    def test_html_has_title(self):
        self.assertIn('Portfolio Console', self.content)

    def test_html_has_table(self):
        self.assertIn('<table>', self.content)

    def test_html_has_13_projects(self):
        count = self.content.count('class="project-card"')
        self.assertEqual(count, 13)


if __name__ == '__main__':
    unittest.main()
