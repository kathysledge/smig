/**
 * @fileoverview Event (trigger) builder for SurrealDB tables.
 * @module schema/entities/event
 */

import { processSurrealQL, validateIdentifier } from '../common/utils';

/**
 * Internal state for event builder.
 */
interface EventBuilderState {
  name: string;
  type: 'CREATE' | 'UPDATE' | 'DELETE' | null;
  when: string | null;
  thenStatement: string | null;
  comments: string[];
  previousNames: string[];
  ifNotExists: boolean;
  overwrite: boolean;
}

/**
 * Event (trigger) definition builder for SurrealDB tables.
 *
 * Events allow automatic execution of SurrealQL code in response to data changes,
 * enabling business logic implementation, data validation, and maintaining
 * data consistency across tables.
 *
 * ## Event Types
 *
 * - **CREATE**: Triggered when new records are inserted
 * - **UPDATE**: Triggered when existing records are modified
 * - **DELETE**: Triggered when records are removed
 *
 * @example
 * ```typescript
 * // Update timestamp on record changes
 * const updateTimestamp = event('update_timestamp')
 *   .onUpdate()
 *   .then('SET updatedAt = time::now()');
 *
 * // Cascade delete related records
 * const cascadeDelete = event('cascade_posts')
 *   .onDelete()
 *   .then('DELETE post WHERE authorId = $value.id');
 *
 * // Conditional event with when clause
 * const notifyAdmin = event('notify_admin')
 *   .onCreate()
 *   .when('$after.priority = "high"')
 *   .then('http::post("https://api.example.com/notify", $after)');
 * ```
 */
export class SurrealQLEvent {
  private event: EventBuilderState = {
    name: '',
    type: null,
    when: null,
    thenStatement: null,
    comments: [],
    previousNames: [],
    ifNotExists: false,
    overwrite: false,
  };
  private triggerSet = false;

  constructor(name: string) {
    validateIdentifier(name, 'Event');
    this.event.name = name.trim();
  }

  /** Uses IF NOT EXISTS clause when defining the event */
  ifNotExists() {
    this.event.ifNotExists = true;
    return this;
  }

  /** Uses OVERWRITE clause when redefining the event */
  overwrite() {
    this.event.overwrite = true;
    return this;
  }

  /** Sets the event to trigger on CREATE operations */
  onCreate() {
    this.event.type = 'CREATE';
    this.triggerSet = true;
    return this;
  }

  /** Sets the event to trigger on UPDATE operations */
  onUpdate() {
    this.event.type = 'UPDATE';
    this.triggerSet = true;
    return this;
  }

  /** Sets the event to trigger on DELETE operations */
  onDelete() {
    this.event.type = 'DELETE';
    this.triggerSet = true;
    return this;
  }

  /** Sets a condition that must be met for the event to execute */
  when(condition: string) {
    this.event.when = processSurrealQL(condition);
    return this;
  }

  /** Sets the SurrealQL code to execute when the event triggers */
  then(action: string) {
    if (!action || action.trim() === '') {
      throw new Error('THEN clause is required and cannot be empty');
    }
    this.event.thenStatement = processSurrealQL(action);
    return this;
  }

  /** Adds a documentation comment for the event */
  comment(text: string) {
    if (text && text.trim() !== '') {
      this.event.comments.push(text.trim());
    }
    return this;
  }

  /**
   * Tracks previous name(s) for this event (for ALTER EVENT RENAME operations).
   *
   * @param names - Previous event name(s)
   * @returns The event instance for method chaining
   */
  was(names: string | string[]) {
    const nameArray = Array.isArray(names) ? names : [names];
    (this.event.previousNames as string[]).push(...nameArray);
    return this;
  }

  /** Builds and validates the complete event definition */
  build() {
    if (!this.triggerSet) {
      throw new Error('Event trigger type must be set. Use onCreate(), onUpdate(), or onDelete().');
    }

    if (!this.event.thenStatement) {
      throw new Error('Event THEN clause is required. Use .then("your SurrealQL here").');
    }

    // biome-ignore lint/suspicious/noExplicitAny: Dynamic event builder requires flexible typing
    const event = this.event as any;
    // Return a copy to prevent external mutation
    return {
      name: this.event.name,
      type: this.event.type,
      when: this.event.when,
      thenStatement: this.event.thenStatement,
      comments: [...event.comments],
      previousNames: [...event.previousNames],
      ifNotExists: this.event.ifNotExists,
      overwrite: this.event.overwrite,
    };
  }
}
