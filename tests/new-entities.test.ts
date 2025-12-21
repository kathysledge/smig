/**
 * @fileoverview Tests for new SurrealDB 3.x entity builders.
 */

import { describe, expect, it } from 'vitest';
import { access, config, model, param, sequence, table, user } from '../src/schema';

describe('New Entity Builders (SurrealDB 3.x)', () => {
  describe('access()', () => {
    describe('JWT access', () => {
      it('should create a basic JWT access', () => {
        const acc = access('api').jwt().algorithm('HS256').key('my-secret').build();
        expect(acc.name).toBe('api');
        expect(acc.type).toBe('JWT');
        expect(acc.algorithm).toBe('HS256');
        expect(acc.key).toBe('my-secret');
      });

      it('should create JWT access with JWKS URL', () => {
        const acc = access('oauth')
          .jwt()
          .url('https://auth.example.com/.well-known/jwks.json')
          .build();
        expect(acc.type).toBe('JWT');
        expect(acc.url).toBe('https://auth.example.com/.well-known/jwks.json');
      });

      it('should set issuer claim', () => {
        const acc = access('jwt_auth')
          .jwt()
          .algorithm('RS256')
          .key('public-key')
          .issuer('https://auth.example.com')
          .build();
        expect(acc.issuer).toBe('https://auth.example.com');
      });
    });

    describe('RECORD access', () => {
      it('should create a basic RECORD access', () => {
        const acc = access('user')
          .record()
          .signup('CREATE user SET email = $email')
          .signin('SELECT * FROM user WHERE email = $email')
          .build();
        expect(acc.type).toBe('RECORD');
        expect(acc.signup).toContain('CREATE user');
        expect(acc.signin).toContain('SELECT * FROM user');
      });

      it('should set session duration', () => {
        const acc = access('session')
          .record()
          .signin('SELECT * FROM user WHERE email = $email')
          .session('7d')
          .build();
        expect(acc.session).toBe('7d');
      });

      it('should set authenticate clause', () => {
        const acc = access('custom')
          .record()
          .signin('SELECT * FROM user WHERE email = $email')
          .authenticate('SELECT * FROM $auth WHERE active = true')
          .build();
        expect(acc.authenticate).toContain('SELECT * FROM $auth');
      });
    });

    describe('BEARER access', () => {
      it('should create BEARER access', () => {
        const acc = access('api_key').bearer().key('token', 'string').duration('30d').build();
        expect(acc.type).toBe('BEARER');
        expect(acc.bearerKey).toBe('token');
        expect(acc.bearerType).toBe('string');
        expect(acc.duration).toBe('30d');
      });
    });

    describe('access levels', () => {
      it('should set namespace level', () => {
        const acc = access('ns_access').jwt().algorithm('HS256').key('key').onNamespace().build();
        expect(acc.level).toBe('NAMESPACE');
      });

      it('should default to database level', () => {
        const acc = access('db_access').jwt().algorithm('HS256').key('key').build();
        expect(acc.level).toBe('DATABASE');
      });
    });

    describe('rename tracking', () => {
      it('should track previous names', () => {
        const acc = access('auth').was('old_auth').jwt().algorithm('HS256').key('key').build();
        expect(acc.previousNames).toEqual(['old_auth']);
      });
    });

    it('should throw if type not set', () => {
      expect(() => access('invalid').build()).toThrow('Access type must be set');
    });
  });

  describe('user()', () => {
    it('should create a basic user', () => {
      const u = user('admin').password('secure-password').role('OWNER').build();
      expect(u.name).toBe('admin');
      expect(u.password).toBe('secure-password');
      expect(u.role).toBe('OWNER');
      expect(u.level).toBe('DATABASE');
    });

    it('should create user with passhash', () => {
      const u = user('admin').passhash('$argon2id$hash').role('OWNER').build();
      expect(u.passhash).toBe('$argon2id$hash');
    });

    it('should support multiple roles', () => {
      const u = user('editor').password('pass').roles(['EDITOR', 'VIEWER']).build();
      expect(u.roles).toEqual(['EDITOR', 'VIEWER']);
    });

    it('should set namespace level', () => {
      const u = user('ns_admin').password('pass').role('OWNER').onNamespace().build();
      expect(u.level).toBe('NAMESPACE');
    });

    it('should set root level', () => {
      const u = user('root_admin').password('pass').role('OWNER').onRoot().build();
      expect(u.level).toBe('ROOT');
    });

    it('should set duration', () => {
      const u = user('temp').password('pass').role('VIEWER').duration('24h').build();
      expect(u.duration).toBe('24h');
    });

    it('should track previous names', () => {
      const u = user('admin').was('administrator').password('pass').role('OWNER').build();
      expect(u.previousNames).toEqual(['administrator']);
    });

    it('should throw if password not set', () => {
      expect(() => user('nopw').role('VIEWER').build()).toThrow('requires a password');
    });

    it('should throw if role not set', () => {
      expect(() => user('norole').password('pass').build()).toThrow('requires a role');
    });
  });

  describe('param()', () => {
    it('should create a string parameter', () => {
      const p = param('app_name').value('"My Application"').build();
      expect(p.name).toBe('app_name');
      expect(p.value).toBe('"My Application"');
    });

    it('should create a numeric parameter', () => {
      const p = param('max_items').value('100').build();
      expect(p.value).toBe('100');
    });

    it('should handle $ prefix in name', () => {
      const p = param('$config').value('{}').build();
      expect(p.name).toBe('config');
    });

    it('should track previous names', () => {
      const p = param('new_name').was('old_name').value('123').build();
      expect(p.previousNames).toEqual(['old_name']);
    });

    it('should throw if value not set', () => {
      expect(() => param('empty').build()).toThrow('requires a value');
    });
  });

  describe('sequence()', () => {
    it('should create a basic sequence', () => {
      const seq = sequence('order_number').build();
      expect(seq.name).toBe('order_number');
    });

    it('should set start value', () => {
      const seq = sequence('invoice').start(1000).build();
      expect(seq.start).toBe(1000);
    });

    // Note: step, min, max, cycle, noCycle, cache methods are not supported in SurrealDB 3.x
    // Only START is supported for sequences

    it('should track previous names', () => {
      const seq = sequence('new_seq').was('old_seq').build();
      expect(seq.previousNames).toEqual(['old_seq']);
    });
  });

  describe('model()', () => {
    it('should create a basic model', () => {
      const m = model('embedder').build();
      expect(m.name).toBe('embedder');
    });

    it('should set version', () => {
      const m = model('classifier').version('1.0.0').build();
      expect(m.version).toBe('1.0.0');
    });

    it('should set permission', () => {
      const m = model('private_model').permission('FULL').build();
      expect(m.permission).toBe('FULL');
    });

    it('should track previous names', () => {
      const m = model('new_model').was('old_model').build();
      expect(m.previousNames).toEqual(['old_model']);
    });
  });

  describe('config()', () => {
    describe('GraphQL config', () => {
      it('should create GraphQL config with AUTO tables', () => {
        const c = config('GRAPHQL').tables('AUTO').build();
        expect(c.type).toBe('GRAPHQL');
        expect(c.tablesMode).toBe('AUTO');
      });

      it('should set INCLUDE tables', () => {
        const c = config('GRAPHQL').tables('INCLUDE', ['user', 'post']).build();
        expect(c.tablesMode).toBe('INCLUDE');
        expect(c.tablesList).toEqual(['user', 'post']);
      });

      it('should set EXCLUDE tables', () => {
        const c = config('GRAPHQL').tables('EXCLUDE', ['internal', 'migrations']).build();
        expect(c.tablesMode).toBe('EXCLUDE');
        expect(c.tablesList).toEqual(['internal', 'migrations']);
      });

      it('should set functions mode', () => {
        const c = config('GRAPHQL').functions('NONE').build();
        expect(c.functionsMode).toBe('NONE');
      });

      it('should set INCLUDE functions', () => {
        const c = config('GRAPHQL').functions('INCLUDE', ['public_fn']).build();
        expect(c.functionsList).toEqual(['public_fn']);
      });
    });

    describe('API config', () => {
      it('should create API config', () => {
        const c = config('API').build();
        expect(c.type).toBe('API');
      });
    });
  });

  describe('table()', () => {
    it('should create a basic table', () => {
      const t = table('user').build();
      expect(t.name).toBe('user');
      expect(t.type).toBe('NORMAL');
      expect(t.schemafull).toBe(true);
    });

    it('should set schemaless', () => {
      const t = table('logs').schemaless().build();
      expect(t.schemafull).toBe(false);
    });

    it('should set relation type', () => {
      const t = table('follows').relation('user', 'user').build();
      expect(t.type).toBe('RELATION');
      expect(t.from).toBe('user');
      expect(t.to).toBe('user');
    });

    it('should set enforced relations', () => {
      const t = table('authored').relation('user', 'post').enforced().build();
      expect(t.enforced).toBe(true);
    });

    it('should set ANY type', () => {
      const t = table('dynamic').any().build();
      expect(t.type).toBe('ANY');
    });

    it('should set drop', () => {
      const t = table('temp').drop().build();
      expect(t.drop).toBe(true);
    });

    it('should set view (AS)', () => {
      const t = table('active_users').view('SELECT * FROM user WHERE active = true').build();
      expect(t.as).toContain('SELECT');
    });

    it('should set changefeed', () => {
      const t = table('orders').changefeed('7d', true).build();
      expect(t.changefeedDuration).toBe('7d');
      expect(t.changefeedIncludeOriginal).toBe(true);
    });

    it('should set permissions as string', () => {
      const t = table('public').permissions('FULL').build();
      expect(t.permissions).toBe('FULL');
    });

    it('should set permissions as object', () => {
      const t = table('restricted')
        .permissions({
          select: 'WHERE published = true',
          create: 'WHERE $auth.role = "admin"',
        })
        .build();
      expect(t.permissions).toHaveProperty('select');
      expect(t.permissions).toHaveProperty('create');
    });

    it('should track previous names', () => {
      const t = table('user').was('users').build();
      expect(t.previousNames).toEqual(['users']);
    });

    it('should track multiple previous names', () => {
      const t = table('account').was(['user', 'users']).build();
      expect(t.previousNames).toEqual(['user', 'users']);
    });

    it('should set comment', () => {
      const t = table('documented').comment('This is a documented table').build();
      expect(t.comment).toBe('This is a documented table');
    });
  });
});
