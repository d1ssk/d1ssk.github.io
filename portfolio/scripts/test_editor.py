"""Run with: python3 -m unittest discover -s portfolio/scripts -p 'test_*.py'."""
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

import serve_editor as editor
import update_gallery as gallery


class EditorTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        for name, value in {"ROOT": self.root, "WORKS": self.root / "assets/works",
                            "POOL": self.root / "assets/pool", "COLLECTION": self.root / "collection.json"}.items():
            patcher = patch.object(gallery, name, value)
            patcher.start()
            self.addCleanup(patcher.stop)
        (self.root / "index.template.html").write_text('<section><!-- GALLERY --></section>')
        for identifier in ('photo', 'drawing'):
            directory = gallery.WORKS / identifier
            directory.mkdir(parents=True)
            gallery.write_json(directory / 'info.json', {'image': {'width': 1200, 'height': 800, 'fullWidth': 2400}, 'alt': '<safe>'})
        gallery.write_json(gallery.COLLECTION, ['photo', 'drawing'])
        gallery.render_gallery(['photo', 'drawing'])

    def test_remove_reload_restore_and_order(self):
        version = editor.save_collection(['drawing'], editor.revision())
        self.assertEqual(gallery.read_json(gallery.COLLECTION), ['drawing'])
        self.assertNotIn('works/photo/', (self.root / 'index.html').read_text())
        self.assertIn('photo', editor.catalog())
        editor.save_collection(['drawing', 'photo'], version)
        output = (self.root / 'index.html').read_text()
        self.assertLess(output.index('works/drawing/'), output.index('works/photo/'))
        self.assertIn('&lt;safe&gt;', output)

    def test_invalid_input_and_conflict_do_not_write(self):
        original = gallery.COLLECTION.read_bytes()
        for value in (['photo', 'photo'], ['missing'], ['../photo'], [None], 'photo', None):
            with self.assertRaises((ValueError, TypeError)):
                editor.save_collection(value, editor.revision())
            self.assertEqual(gallery.COLLECTION.read_bytes(), original)
        with self.assertRaises(FileExistsError):
            editor.save_collection([], 'old revision')
        self.assertEqual(gallery.COLLECTION.read_bytes(), original)

    def test_empty_collection_and_invalid_template(self):
        editor.save_collection([], editor.revision())
        self.assertEqual(gallery.read_json(gallery.COLLECTION), [])
        (self.root / 'index.template.html').write_text('broken template')
        with self.assertRaises(ValueError):
            editor.save_collection(['photo'], editor.revision())
        self.assertEqual(gallery.read_json(gallery.COLLECTION), [])

    def test_metadata_save_preserves_system_fields_and_regenerates_alt(self):
        path = gallery.WORKS / 'photo/info.json'
        info = gallery.read_json(path)
        info.update(source='assets/pool/photo.jpg', custom={'retain': True})
        gallery.write_json(path, info)
        before = editor.revision()
        changes = {'photo': {
            'title': '夜景', 'location': '東京', 'description': '説明', 'alt': '夜景 <image>',
            'visibility': {'title': False, 'location': True, 'description': False},
            'details': [{'label': 'ISO', 'value': '800', 'show': False},
                        {'label': 'Captured', 'value': '2026-01-01', 'show': True},
                        {'label': '画材', 'value': '鉛筆', 'show': True, 'custom': 1}],
        }}
        after = editor.save_collection(['photo'], before, changes)
        saved = gallery.read_json(path)
        self.assertNotEqual(before, after)
        self.assertEqual(saved['source'], info['source'])
        self.assertEqual(saved['image'], info['image'])
        self.assertEqual(saved['custom'], info['custom'])
        for field, value in changes['photo'].items():
            self.assertEqual(saved[field], value)
        self.assertIn('夜景 &lt;image&gt;', (self.root / 'index.html').read_text())
        # Information can be edited while the work is excluded, and survives restoration.
        editor.save_collection(['photo'], after, {'drawing': {'title': '非表示の絵'}})
        self.assertEqual(editor.catalog()['drawing']['title'], '非表示の絵')
        editor.save_collection(['photo', 'drawing'], editor.revision())
        self.assertEqual(editor.catalog()['drawing']['title'], '非表示の絵')

    def test_metadata_conflict_and_invalid_values_do_not_write(self):
        old_revision = editor.revision()
        path = gallery.WORKS / 'photo/info.json'
        info = gallery.read_json(path)
        info['title'] = 'External edit'
        gallery.write_json(path, info)
        with self.assertRaises(FileExistsError):
            editor.save_collection(['photo'], old_revision, {'photo': {'title': 'Overwrite'}})
        originals = {p: p.read_bytes() for p in self.root.rglob('*') if p.is_file()}
        for changes in ([], {'missing': {}}, {'photo': {'source': 'other'}},
                        {'photo': {'image': {}}}, {'photo': {'title': 123}},
                        {'photo': {'visibility': {'title': 'false'}}},
                        {'photo': {'visibility': {'unknown': True}}},
                        {'photo': {'details': [None]}},
                        {'photo': {'details': [{'label': 'ISO', 'value': '1', 'show': 'yes'}]}}):
            with self.assertRaises(ValueError):
                editor.save_collection(['photo'], editor.revision(), changes)
            self.assertEqual({p: p.read_bytes() for p in originals}, originals)

    def test_write_failure_restores_metadata_collection_and_html(self):
        originals = {p: p.read_bytes() for p in self.root.rglob('*') if p.is_file()}
        write = Path.write_bytes
        failed = False

        def fail_once(path, content):
            nonlocal failed
            if path == gallery.WORKS / 'photo/info.json' and not failed:
                failed = True
                write(path, b'partial write')
                raise OSError('simulated disk failure')
            return write(path, content)

        with patch.object(Path, 'write_bytes', fail_once), self.assertRaises(OSError):
            editor.save_collection(['photo'], editor.revision(), {'photo': {'title': 'New'}})
        self.assertEqual({p: p.read_bytes() for p in originals}, originals)

    def test_import_does_not_restore_hidden_work(self):
        gallery.POOL.mkdir(parents=True)
        (gallery.POOL / 'photo.jpg').touch()
        (gallery.POOL / 'new.jpg').touch()
        with patch.object(gallery.shutil, 'which', return_value='/mock/magick'), \
             patch.dict('sys.modules', {'PIL': object()}), \
             patch.object(gallery, 'import_work', return_value={}):
            self.assertEqual(gallery.import_pool(['drawing']), ['drawing', 'new'])


if __name__ == '__main__':
    unittest.main()
