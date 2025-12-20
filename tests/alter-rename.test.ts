/**
 * @fileoverview Tests for ALTER statements and rename detection.
 */

import { describe, expect, it } from 'vitest';
import {
  alterTableRename,
  alterTableType,
  alterTableChangefeed,
  alterTableComment,
  alterTablePermissions,
  alterFieldRename,
  alterFieldType,
  alterFieldDefault,
  alterFieldValue,
  alterFieldAssert,
  alterFieldReadonly,
  alterFieldFlexible,
  alterFieldPermissions,
  alterFieldComment,
  alterFieldReference,
  alterIndexRename,
  alterIndexComment,
  alterEventRename,
  alterEventWhen,
  alterEventThen,
  alterEventComment,
  alterFunctionRename,
  alterFunctionPermissions,
  alterFunctionComment,
  alterAnalyzerRename,
  alterAnalyzerComment,
  alterAccessRename,
  alterAccessAuthenticate,
  alterAccessDuration,
  alterAccessComment,
  alterParamRename,
  alterParamValue,
  alterParamPermissions,
  alterParamComment,
  alterSequenceRename,
  alterSequenceRestart,
  alterSequenceCache,
  alterSequenceComment,
  alterUserRename,
  alterUserPassword,
  alterUserRoles,
  alterUserComment,
} from '../src/generators';
import {
  detectTableRename,
  detectFieldRenameByWas,
  detectIndexRenameByWas,
  detectFunctionRename,
  detectAnalyzerRename,
  detectAccessRename,
  detectGenericRename,
} from '../src/migrator/comparison';

describe('ALTER Statement Generators', () => {
  describe('ALTER TABLE', () => {
    it('should generate table rename', () => {
      expect(alterTableRename('users', 'customers')).toBe(
        'ALTER TABLE users RENAME TO customers;',
      );
    });

    it('should generate table type change', () => {
      expect(alterTableType('edge', 'RELATION')).toBe('ALTER TABLE edge TYPE RELATION;');
    });

    it('should generate changefeed addition', () => {
      expect(alterTableChangefeed('audit', '7d')).toBe('ALTER TABLE audit CHANGEFEED 7d;');
    });

    it('should generate changefeed with INCLUDE ORIGINAL', () => {
      expect(alterTableChangefeed('audit', '30d', true)).toBe(
        'ALTER TABLE audit CHANGEFEED 30d INCLUDE ORIGINAL;',
      );
    });

    it('should generate changefeed removal', () => {
      expect(alterTableChangefeed('audit', null)).toBe('ALTER TABLE audit CHANGEFEED NONE;');
    });
  });

  describe('ALTER FIELD', () => {
    it('should generate field rename', () => {
      expect(alterFieldRename('user', 'userName', 'fullName')).toBe(
        'ALTER FIELD userName ON TABLE user RENAME TO fullName;',
      );
    });

    it('should generate field type change', () => {
      expect(alterFieldType('user', 'age', 'float')).toBe(
        'ALTER FIELD age ON TABLE user TYPE float;',
      );
    });

    it('should generate field default change', () => {
      expect(alterFieldDefault('user', 'status', "'active'")).toBe(
        "ALTER FIELD status ON TABLE user DEFAULT 'active';",
      );
    });

    it('should generate field default removal', () => {
      expect(alterFieldDefault('user', 'status', null)).toBe(
        'ALTER FIELD status ON TABLE user DEFAULT NONE;',
      );
    });

    it('should generate field VALUE change', () => {
      expect(alterFieldValue('user', 'updatedAt', 'time::now()')).toBe(
        'ALTER FIELD updatedAt ON TABLE user VALUE time::now();',
      );
    });

    it('should generate field VALUE removal', () => {
      expect(alterFieldValue('user', 'updatedAt', null)).toBe(
        'ALTER FIELD updatedAt ON TABLE user VALUE NONE;',
      );
    });

    it('should generate field ASSERT change', () => {
      expect(alterFieldAssert('user', 'email', 'string::is_email($value)')).toBe(
        'ALTER FIELD email ON TABLE user ASSERT string::is_email($value);',
      );
    });

    it('should generate field ASSERT removal', () => {
      expect(alterFieldAssert('user', 'email', null)).toBe(
        'ALTER FIELD email ON TABLE user ASSERT NONE;',
      );
    });

    it('should generate field READONLY addition', () => {
      expect(alterFieldReadonly('user', 'createdAt', true)).toBe(
        'ALTER FIELD createdAt ON TABLE user READONLY;',
      );
    });

    it('should generate field FLEXIBLE addition', () => {
      expect(alterFieldFlexible('user', 'metadata', true)).toBe(
        'ALTER FIELD metadata ON TABLE user FLEXIBLE;',
      );
    });

    it('should generate field PERMISSIONS change', () => {
      expect(alterFieldPermissions('user', 'email', 'WHERE $auth.id = id')).toBe(
        'ALTER FIELD email ON TABLE user PERMISSIONS WHERE $auth.id = id;',
      );
    });

    it('should generate field PERMISSIONS with object', () => {
      const result = alterFieldPermissions('user', 'salary', {
        select: 'WHERE $auth.role = "admin"',
        update: 'WHERE false',
      });
      expect(result).toContain('FOR select WHERE $auth.role = "admin"');
      expect(result).toContain('FOR update WHERE false');
    });

    it('should generate field COMMENT change', () => {
      expect(alterFieldComment('user', 'email', 'User email address')).toBe(
        'ALTER FIELD email ON TABLE user COMMENT "User email address";',
      );
    });

    it('should generate field REFERENCE change', () => {
      expect(alterFieldReference('post', 'author', 'CASCADE')).toBe(
        'ALTER FIELD author ON TABLE post REFERENCE ON DELETE CASCADE;',
      );
    });
  });

  describe('ALTER TABLE - Additional', () => {
    it('should generate table COMMENT change', () => {
      expect(alterTableComment('user', 'User accounts')).toBe(
        'ALTER TABLE user COMMENT "User accounts";',
      );
    });

    it('should generate table COMMENT removal', () => {
      expect(alterTableComment('user', null)).toBe('ALTER TABLE user COMMENT NONE;');
    });

    it('should generate table PERMISSIONS change', () => {
      const result = alterTablePermissions('user', {
        select: 'WHERE $auth.id = id',
        delete: 'WHERE $auth.role = "admin"',
      });
      expect(result).toContain('FOR select WHERE $auth.id = id');
      expect(result).toContain('FOR delete WHERE $auth.role = "admin"');
    });
  });

  describe('ALTER INDEX', () => {
    it('should generate index rename', () => {
      expect(alterIndexRename('user', 'idx_email', 'idx_user_email')).toBe(
        'ALTER INDEX idx_email ON TABLE user RENAME TO idx_user_email;',
      );
    });

    it('should generate index COMMENT change', () => {
      expect(alterIndexComment('user', 'idx_email', 'Email lookup index')).toBe(
        'ALTER INDEX idx_email ON TABLE user COMMENT "Email lookup index";',
      );
    });

    it('should generate index COMMENT removal', () => {
      expect(alterIndexComment('user', 'idx_email', null)).toBe(
        'ALTER INDEX idx_email ON TABLE user COMMENT NONE;',
      );
    });
  });

  describe('ALTER EVENT', () => {
    it('should generate event rename', () => {
      expect(alterEventRename('user', 'on_update', 'track_updates')).toBe(
        'ALTER EVENT on_update ON TABLE user RENAME TO track_updates;',
      );
    });

    it('should generate event WHEN change', () => {
      expect(alterEventWhen('user', 'track_updates', '$event = "UPDATE"')).toBe(
        'ALTER EVENT track_updates ON TABLE user WHEN $event = "UPDATE";',
      );
    });

    it('should generate event THEN change', () => {
      expect(alterEventThen('user', 'track_updates', 'CREATE audit SET action = $event')).toBe(
        'ALTER EVENT track_updates ON TABLE user THEN CREATE audit SET action = $event;',
      );
    });

    it('should generate event COMMENT change', () => {
      expect(alterEventComment('user', 'track_updates', 'Tracks user modifications')).toBe(
        'ALTER EVENT track_updates ON TABLE user COMMENT "Tracks user modifications";',
      );
    });
  });

  describe('ALTER FUNCTION', () => {
    it('should generate function rename', () => {
      expect(alterFunctionRename('fn::get_user', 'fn::fetch_user')).toBe(
        'ALTER FUNCTION fn::get_user RENAME TO fn::fetch_user;',
      );
    });

    it('should generate function PERMISSIONS change', () => {
      expect(alterFunctionPermissions('fn::admin_only', 'WHERE $auth.role = "admin"')).toBe(
        'ALTER FUNCTION fn::admin_only PERMISSIONS WHERE $auth.role = "admin";',
      );
    });

    it('should generate function COMMENT change', () => {
      expect(alterFunctionComment('fn::get_user', 'Fetches a user by ID')).toBe(
        'ALTER FUNCTION fn::get_user COMMENT "Fetches a user by ID";',
      );
    });
  });

  describe('ALTER ANALYZER', () => {
    it('should generate analyzer rename', () => {
      expect(alterAnalyzerRename('english_basic', 'english_full')).toBe(
        'ALTER ANALYZER english_basic RENAME TO english_full;',
      );
    });

    it('should generate analyzer COMMENT change', () => {
      expect(alterAnalyzerComment('english_full', 'Full English text analyzer')).toBe(
        'ALTER ANALYZER english_full COMMENT "Full English text analyzer";',
      );
    });
  });

  describe('ALTER ACCESS', () => {
    it('should generate access rename on database', () => {
      expect(alterAccessRename('user_auth', 'customer_auth')).toBe(
        'ALTER ACCESS user_auth ON DATABASE RENAME TO customer_auth;',
      );
    });

    it('should generate access rename on namespace', () => {
      expect(alterAccessRename('admin', 'super_admin', 'NAMESPACE')).toBe(
        'ALTER ACCESS admin ON NAMESPACE RENAME TO super_admin;',
      );
    });

    it('should generate access AUTHENTICATE change', () => {
      expect(
        alterAccessAuthenticate('user_auth', 'IF $auth.active = true THEN $auth ELSE NONE END'),
      ).toBe(
        'ALTER ACCESS user_auth ON DATABASE AUTHENTICATE IF $auth.active = true THEN $auth ELSE NONE END;',
      );
    });

    it('should generate access DURATION change', () => {
      expect(alterAccessDuration('user_auth', 'SESSION', '24h')).toBe(
        'ALTER ACCESS user_auth ON DATABASE DURATION FOR SESSION 24h;',
      );
    });

    it('should generate access DURATION for TOKEN', () => {
      expect(alterAccessDuration('user_auth', 'TOKEN', '15m')).toBe(
        'ALTER ACCESS user_auth ON DATABASE DURATION FOR TOKEN 15m;',
      );
    });

    it('should generate access COMMENT change', () => {
      expect(alterAccessComment('user_auth', 'User authentication method')).toBe(
        'ALTER ACCESS user_auth ON DATABASE COMMENT "User authentication method";',
      );
    });
  });

  describe('ALTER USER', () => {
    it('should generate user rename', () => {
      expect(alterUserRename('admin', 'superadmin')).toBe(
        'ALTER USER admin ON DATABASE RENAME TO superadmin;',
      );
    });

    it('should generate user PASSWORD change', () => {
      expect(alterUserPassword('admin', 'newSecurePassword123')).toBe(
        'ALTER USER admin ON DATABASE PASSWORD "newSecurePassword123";',
      );
    });

    it('should generate user ROLES change', () => {
      expect(alterUserRoles('admin', ['OWNER', 'EDITOR'])).toBe(
        'ALTER USER admin ON DATABASE ROLES OWNER, EDITOR;',
      );
    });

    it('should generate user COMMENT change', () => {
      expect(alterUserComment('admin', 'Database administrator')).toBe(
        'ALTER USER admin ON DATABASE COMMENT "Database administrator";',
      );
    });

    it('should handle namespace level', () => {
      expect(alterUserRename('admin', 'superadmin', 'NAMESPACE')).toBe(
        'ALTER USER admin ON NAMESPACE RENAME TO superadmin;',
      );
    });

    it('should handle root level', () => {
      expect(alterUserRename('root', 'superroot', 'ROOT')).toBe(
        'ALTER USER root ON ROOT RENAME TO superroot;',
      );
    });
  });

  describe('ALTER PARAM', () => {
    it('should generate param rename', () => {
      expect(alterParamRename('api_key', 'auth_token')).toBe(
        'ALTER PARAM $api_key RENAME TO $auth_token;',
      );
    });

    it('should handle $ prefix', () => {
      expect(alterParamRename('$old_param', '$new_param')).toBe(
        'ALTER PARAM $old_param RENAME TO $new_param;',
      );
    });

    it('should generate param VALUE change', () => {
      expect(alterParamValue('max_limit', '100')).toBe('ALTER PARAM $max_limit VALUE 100;');
    });

    it('should generate param PERMISSIONS change', () => {
      expect(alterParamPermissions('admin_key', 'WHERE $auth.role = "admin"')).toBe(
        'ALTER PARAM $admin_key PERMISSIONS WHERE $auth.role = "admin";',
      );
    });

    it('should generate param COMMENT change', () => {
      expect(alterParamComment('max_limit', 'Maximum query limit')).toBe(
        'ALTER PARAM $max_limit COMMENT "Maximum query limit";',
      );
    });
  });

  describe('ALTER SEQUENCE', () => {
    it('should generate sequence rename', () => {
      expect(alterSequenceRename('order_seq', 'invoice_seq')).toBe(
        'ALTER SEQUENCE order_seq RENAME TO invoice_seq;',
      );
    });

    it('should generate sequence RESTART change', () => {
      expect(alterSequenceRestart('order_seq', 1000)).toBe('ALTER SEQUENCE order_seq RESTART 1000;');
    });

    it('should generate sequence CACHE change', () => {
      expect(alterSequenceCache('order_seq', 50)).toBe('ALTER SEQUENCE order_seq CACHE 50;');
    });

    it('should generate sequence COMMENT change', () => {
      expect(alterSequenceComment('order_seq', 'Order numbering sequence')).toBe(
        'ALTER SEQUENCE order_seq COMMENT "Order numbering sequence";',
      );
    });
  });
});

describe('Rename Detection', () => {
  describe('Table Rename Detection', () => {
    it('should detect table rename when old name exists', () => {
      const newTable = { name: 'customers', was: 'users' };
      const currentTables = [{ name: 'users' }, { name: 'posts' }];

      const result = detectTableRename(newTable, currentTables);

      expect(result.isRenamed).toBe(true);
      expect(result.oldName).toBe('users');
      expect(result.newName).toBe('customers');
    });

    it('should not detect rename when new name already exists', () => {
      const newTable = { name: 'customers', was: 'users' };
      const currentTables = [{ name: 'users' }, { name: 'customers' }];

      const result = detectTableRename(newTable, currentTables);

      expect(result.isRenamed).toBe(false);
    });

    it('should not detect rename without was property', () => {
      const newTable = { name: 'customers' };
      const currentTables = [{ name: 'users' }];

      const result = detectTableRename(newTable, currentTables);

      expect(result.isRenamed).toBe(false);
    });

    it('should handle array of previous names', () => {
      const newTable = { name: 'customers', was: ['clients', 'users'] };
      const currentTables = [{ name: 'users' }];

      const result = detectTableRename(newTable, currentTables);

      expect(result.isRenamed).toBe(true);
      expect(result.oldName).toBe('users');
    });

    it('should prefer first matching previous name', () => {
      const newTable = { name: 'customers', was: ['clients', 'users'] };
      const currentTables = [{ name: 'clients' }, { name: 'users' }];

      const result = detectTableRename(newTable, currentTables);

      expect(result.isRenamed).toBe(true);
      expect(result.oldName).toBe('clients');
    });
  });

  describe('Field Rename Detection', () => {
    it('should detect field rename', () => {
      const newField = { name: 'fullName', previousName: 'name' };
      const currentFields = [{ name: 'name' }, { name: 'email' }];

      const result = detectFieldRenameByWas('user', newField, currentFields);

      expect(result.isRenamed).toBe(true);
      expect(result.oldName).toBe('name');
    });

    it('should not detect rename when field is new', () => {
      const newField = { name: 'avatar', previousName: 'photo' };
      const currentFields = [{ name: 'name' }, { name: 'email' }];

      const result = detectFieldRenameByWas('user', newField, currentFields);

      expect(result.isRenamed).toBe(false);
    });
  });

  describe('Index Rename Detection', () => {
    it('should detect index rename', () => {
      const newIndex = { name: 'idx_user_email', previousName: 'idx_email' };
      const currentIndexes = [{ name: 'idx_email' }];

      const result = detectIndexRenameByWas('user', newIndex, currentIndexes);

      expect(result.isRenamed).toBe(true);
      expect(result.oldName).toBe('idx_email');
    });
  });

  describe('Function Rename Detection', () => {
    it('should detect function rename', () => {
      const newFunc = { name: 'fn::get_customer', was: 'fn::get_user' };
      const currentFunctions = [{ name: 'fn::get_user' }];

      const result = detectFunctionRename(newFunc, currentFunctions);

      expect(result.isRenamed).toBe(true);
      expect(result.oldName).toBe('fn::get_user');
    });
  });

  describe('Analyzer Rename Detection', () => {
    it('should detect analyzer rename', () => {
      const newAnalyzer = { name: 'english_full', was: 'english_basic' };
      const currentAnalyzers = [{ name: 'english_basic' }];

      const result = detectAnalyzerRename(newAnalyzer, currentAnalyzers);

      expect(result.isRenamed).toBe(true);
      expect(result.oldName).toBe('english_basic');
    });
  });

  describe('Access Rename Detection', () => {
    it('should detect access rename', () => {
      const newAccess = { name: 'customer_auth', was: 'user_auth' };
      const currentAccesses = [{ name: 'user_auth' }];

      const result = detectAccessRename(newAccess, currentAccesses);

      expect(result.isRenamed).toBe(true);
      expect(result.oldName).toBe('user_auth');
    });
  });

  describe('Generic Rename Detection', () => {
    it('should work for any entity type', () => {
      const newEntity = { name: 'new_name', was: 'old_name' };
      const currentEntities = [{ name: 'old_name' }];

      const result = detectGenericRename(newEntity, currentEntities, 'custom');

      expect(result.isRenamed).toBe(true);
      expect(result.oldName).toBe('old_name');
    });
  });
});

