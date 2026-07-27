Fixture hook bodies for tests/unit/selfcheck-battery.test.mjs.

Every fixture is a NODE script, deliberately. The suite runs on windows-unit (blocking) where
bash may be absent entirely, and a fixture that can only run on POSIX would silently skip the
very assertions it exists to prove. Each one models exactly one real defect class.
