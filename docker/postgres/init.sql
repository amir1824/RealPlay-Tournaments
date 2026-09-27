-- Creates the separate database used by the Jest integration test suite so tests
-- never touch the development database. Runs once, on first container init.
CREATE DATABASE realplay_test;
