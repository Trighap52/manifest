import {
  AppManifest,
  AuthenticableEntity,
  BaseEntity,
  DatabaseConnection,
  EntityManifest,
  GroupManifest,
  PropType,
  PropertyManifest
} from '@repo/types'
import { Injectable } from '@nestjs/common'
import {
  ColumnType,
  EntitySchema,
  EntitySchemaColumnOptions,
  ValueTransformer
} from 'typeorm'
import { sqlitePropTypeColumnTypes } from '../columns/sqlite-prop-type-column-types'
import { RelationshipService } from './relationship.service'
import { EntityManifestService } from '../../manifest/services/entity-manifest.service'
import { mysqlPropTypeColumnTypes } from '../columns/mysql-prop-type-column-types'
import { postgresPropTypeColumnTypes } from '../columns/postgres-prop-type-column-types copy'
import { ColumnService } from './column.service'
import { BooleanTransformer } from '../transformers/boolean-transformer'
import { NumberTransformer } from '../transformers/number-transformer'
import { TimestampTransformer } from '../transformers/timestamp-transformer'
import { ManifestService } from '../../manifest/services/manifest.service'

type ConceptManifest = EntityManifest | GroupManifest

@Injectable()
export class EntityLoaderService {
  constructor(
    private entityManifestService: EntityManifestService,
    private manifestService: ManifestService,
    private relationshipService: RelationshipService
  ) {}

  /**
   * Get entities from Manifest services file and convert into TypeORM entities.
   *
   * @param dbConnection The database connection type (mysql, postgres, sqlite).
   *
   * @returns EntitySchema[] the entities
   *
   **/
  loadEntities(dbConnection: DatabaseConnection): EntitySchema[] {
    const appManifest: AppManifest = this.manifestService.getAppManifest({
      fullVersion: true
    })

    // Get all entities and groups from the manifest.
    const entitiesAndGroups: ConceptManifest[] = [
      ...Object.values(appManifest.entities),
      ...Object.values(appManifest.groups)
    ]

    // Set column types based on the database connection.
    let columns: Record<PropType, ColumnType>

    switch (dbConnection) {
      case 'sqlite':
        columns = sqlitePropTypeColumnTypes
        break
      case 'postgres':
        columns = postgresPropTypeColumnTypes
        break
      case 'mysql':
        columns = mysqlPropTypeColumnTypes
        break
    }

    // Convert Manifest Entities to TypeORM Entities.
    const entitySchemas: EntitySchema[] = entitiesAndGroups.map(
      (conceptManifest: ConceptManifest) => {
        const entitySchema: EntitySchema = new EntitySchema({
          name: conceptManifest.className,

          // Convert properties to columns.
          columns: conceptManifest.properties.reduce(
            (
              acc: { [key: string]: EntitySchemaColumnOptions },
              propManifest: PropertyManifest
            ) => {
              // Set transformer for number properties (Postgres stores numbers as strings).
              let transformer: ValueTransformer | undefined = undefined
              if (
                propManifest.type === PropType.Number ||
                propManifest.type === PropType.Money
              ) {
                transformer = new NumberTransformer()
              }

              // Ensure it returns strings for timestamps (SQLite returns Date objects by default).
              if (propManifest.type === PropType.Timestamp) {
                transformer = new TimestampTransformer()
              }

              if (propManifest.type === PropType.Boolean) {
                transformer = new BooleanTransformer(dbConnection)
              }

              acc[propManifest.name] = {
                name: propManifest.name,
                type: columns[propManifest.type],
                transformer,
                nullable: true // Everything is nullable on the database (validation is done on the application layer).
              }

              return acc
            },
            // Merge with base entities for base columns.
            conceptManifest['authenticable']
              ? { ...this.getBaseAuthenticableEntityColumns(dbConnection) }
              : { ...this.getBaseEntityColumns(dbConnection) }
          ) as { [key: string]: EntitySchemaColumnOptions },
          relations:
            typeof conceptManifest['relationships'] === 'object'
              ? this.relationshipService.getEntitySchemaRelationOptions(
                  conceptManifest as EntityManifest
                )
              : {},
          uniques: conceptManifest['authenticable']
            ? [{ columns: ['email'] }]
            : []
        })

        return entitySchema
      }
    )

    return entitySchemas
  }

  /**
   * Get BaseEntity columns with specific DB connection type. All entities extend from BaseEntity.
   *
   * @param dbConnection The database connection type.
   *
   * @returns { [key in keyof BaseEntity]: EntitySchemaColumnOptions }
   */
  getBaseEntityColumns(dbConnection: DatabaseConnection): {
    [key in keyof BaseEntity]: EntitySchemaColumnOptions
  } {
    let idType: ColumnType

    switch (dbConnection) {
      case 'sqlite':
        idType = 'text'
        break
      case 'postgres':
        idType = 'uuid'
        break
      case 'mysql':
        idType = 'varchar'
        break
    }

    return {
      id: {
        type: idType,
        primary: true,
        generated: 'uuid'
      },
      createdAt: {
        name: 'createdAt',
        type: ColumnService.getColumnType(dbConnection, PropType.Timestamp),
        createDate: true,
        select: false
      },
      updatedAt: {
        name: 'updatedAt',
        type: ColumnService.getColumnType(dbConnection, PropType.Timestamp),
        updateDate: true,
        select: false
      }
    }
  }

  /**
   * Get BaseAuthenticableEntity columns with specific DB connection type. All authenticable entities extend from BaseAuthenticableEntity.
   *
   * @param dbConnection The database connection type.
   *
   * @returns { [key in keyof AuthenticableEntity]: EntitySchemaColumnOptions }
   */
  getBaseAuthenticableEntityColumns(dbConnection: DatabaseConnection): {
    [key in keyof AuthenticableEntity]: EntitySchemaColumnOptions
  } {
    return Object.assign(this.getBaseEntityColumns(dbConnection), {
      email: {
        name: 'email',
        type: ColumnService.getColumnType(dbConnection, PropType.Email),
        unique: true
      },
      password: {
        name: 'password',
        type: ColumnService.getColumnType(dbConnection, PropType.Password),
        select: false
      }
    })
  }
}
