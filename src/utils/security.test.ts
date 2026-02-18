/**
 * Security tests for utility functions
 * Tests to verify fixes for path traversal and format string vulnerabilities
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { expandPath, log, setLogLevel } from './index.js';
import path from 'path';
import os from 'os';

describe('Security Tests', () => {
  describe('expandPath - Path Traversal Prevention', () => {
    it('should expand normal home directory paths safely', () => {
      const result = expandPath('~/Documents/test.txt');
      const expected = path.join(os.homedir(), 'Documents/test.txt');
      expect(result).toBe(expected);
    });

    it('should block path traversal attempts with ../', () => {
      expect(() => expandPath('~/../../../etc/passwd')).toThrow(
        'Path traversal detected: paths cannot contain "../" sequences'
      );
    });

    it('should block path traversal attempts in subdirectories', () => {
      expect(() => expandPath('~/docs/../../../etc/passwd')).toThrow(
        'Path traversal detected: paths cannot contain "../" sequences'
      );
    });

    it('should block relative path traversal', () => {
      expect(() => expandPath('~/../sensitive')).toThrow(
        'Path traversal detected: paths cannot contain "../" sequences'
      );
    });

    it('should allow safe relative paths within home directory', () => {
      const result = expandPath('~/folder/subfolder/file.txt');
      const expected = path.join(os.homedir(), 'folder/subfolder/file.txt');
      expect(result).toBe(expected);
    });

    it('should normalize absolute paths safely', () => {
      const result = expandPath('/safe/absolute/path');
      expect(result).toBe('/safe/absolute/path');
    });

    it('should handle edge cases safely', () => {
      expect(() => expandPath('~/test/../../../root')).toThrow();
      expect(() => expandPath('~/.ssh/../../etc')).toThrow();
    });
  });

  describe('log - Format String Injection Prevention', () => {
    let consoleOutput: string[] = [];
    const originalConsoleLog = console.log;

    beforeEach(() => {
      consoleOutput = [];
      console.log = (...args: any[]) => {
        consoleOutput.push(args.join(' '));
      };
      setLogLevel('debug');
    });

    afterEach(() => {
      console.log = originalConsoleLog;
    });

    it('should log messages safely without format string injection', () => {
      log('info', 'Test message %s %d', 'arg1', 123);
      expect(consoleOutput).toHaveLength(1);
      expect(consoleOutput[0]).toContain('Test message %s %d');
      expect(consoleOutput[0]).toContain('arg1');
      expect(consoleOutput[0]).toContain('123');
    });

    it('should handle potential format string attacks safely', () => {
      const maliciousMessage = 'User input with %s format specifiers %d';
      log('warn', maliciousMessage);
      expect(consoleOutput).toHaveLength(1);
      // The message should be logged as-is without interpreting format specifiers
      expect(consoleOutput[0]).toContain(maliciousMessage);
    });

    it('should safely handle user-controlled content', () => {
      const userInput = 'Malicious %n %x content';
      log('error', userInput, 'additional', 'args');
      expect(consoleOutput).toHaveLength(1);
      expect(consoleOutput[0]).toContain(userInput);
      expect(consoleOutput[0]).toContain('additional');
      expect(consoleOutput[0]).toContain('args');
    });
  });
});