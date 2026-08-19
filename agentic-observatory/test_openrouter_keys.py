import unittest
from unittest.mock import patch
from config.settings import Settings
from utils import openrouter_keys


class TestOpenRouterKeys(unittest.TestCase):
    def test_get_openrouter_api_keys_multiple(self):
        with patch.object(openrouter_keys.settings, "OPENROUTER_API_KEY", "key1, key2 , key3"):
            keys = openrouter_keys.get_openrouter_api_keys()
            self.assertEqual(keys, ["key1", "key2", "key3"])

    def test_get_openrouter_api_keys_empty(self):
        with patch.object(openrouter_keys.settings, "OPENROUTER_API_KEY", ""):
            keys = openrouter_keys.get_openrouter_api_keys()
            self.assertEqual(keys, [])

    def test_rotate_openrouter_key(self):
        with patch.object(openrouter_keys.settings, "OPENROUTER_API_KEY", "keyA,keyB,keyC"):
            # Reset index
            with openrouter_keys._lock:
                openrouter_keys._current_key_index = 0

            self.assertEqual(openrouter_keys.get_active_openrouter_key(), "keyA")
            new_key = openrouter_keys.rotate_openrouter_key(failed_key="keyA", reason="rate limit")
            self.assertEqual(new_key, "keyB")
            self.assertEqual(openrouter_keys.get_active_openrouter_key(), "keyB")

            new_key2 = openrouter_keys.rotate_openrouter_key(failed_key="keyB", reason="401 error")
            self.assertEqual(new_key2, "keyC")
            self.assertEqual(openrouter_keys.get_active_openrouter_key(), "keyC")


if __name__ == "__main__":
    unittest.main()
