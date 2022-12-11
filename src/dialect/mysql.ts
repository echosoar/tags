import { TAG_ERROR } from "../error";
import { MysqlQuery, ITagBindOptions, ITagDefine, ITagDialect, ITagInitOptions, ITagItem, ITagListInstanceOptions, ITagListInstanceTagsOptions, ITagListResult, ITagMysqlDialectOption, ITagOperResult, ITagSearchOptions } from "../interface";
import { error, formatMatchLike, getPageOpions, success } from "../utils";

enum TableName {
  Tag = 'tag',
  Relationship = 'relationship',
}

export class MysqlDialect implements ITagDialect {
  private options: ITagInitOptions;
  private dialectOptions: ITagMysqlDialectOption;
  private query: MysqlQuery;
  constructor(options: ITagInitOptions) {
    this.options = options;
    this.dialectOptions = options.dialect as ITagMysqlDialectOption;
    this.query = this.dialectOptions.instance.query;
  }

  async ready(): Promise<void> {
      if (this.dialectOptions.sync) {
        await this.syncTable();
      }
  }

  async new(tagDefine: ITagDefine): Promise<ITagOperResult> {
   const existTagId = await this.getTag(tagDefine.name);
    if (existTagId) {
      return error(TAG_ERROR.EXISTS, {
        id: existTagId,
      });
    }
    const sql = `insert into ${this.buildTableName(TableName.Tag)} (\`name\`, \`descri\`) values (?, ?)`;
    const [raws] = await this.query(sql, [tagDefine.name, tagDefine.desc]);
    if (!raws.insertId) {
      return error(TAG_ERROR.OPER_ERROR);
    }
    return success({
      id: raws.insertId
    });
  }

  async remove(tagIdOrName: number): Promise<ITagOperResult> {
    return success();
  }

  async update(tagIdOrName: number, params: Partial<ITagDefine>): Promise<ITagOperResult> {
    const existTagId = await this.getTag(tagIdOrName);
    if (!existTagId) {
      return error(TAG_ERROR.NOT_EXISTS, { id: tagIdOrName });
    }
    const fields = [];
    const placeholders = [];
    Object.keys(params).forEach(key => {
      if (key === 'id') {
        return;
      }
      let updateKey = key;
      if (key === 'desc') {
        updateKey = 'descri';
      }
      fields.push(`\`${updateKey}\` = ?`);
      placeholders.push(params[key]);
    });
    const sql = `update ${this.buildTableName(TableName.Tag)} set ${fields.join(', ')} where id = ${existTagId}`;
    const [raws] = await this.query(sql, placeholders);
    if (raws.affectedRows !== 1) {
      return error(TAG_ERROR.OPER_ERROR)
    }
    return success({
      id: existTagId
    });
  }
  async list(listOptions?: ITagSearchOptions): Promise<ITagListResult<ITagItem>> {
    const { page, pageSize, match = [], count } = listOptions;
    const { limit, offset } = getPageOpions(page, pageSize);
    const idList = [];
    const nameList = [];
    const placeholder = [];
    for(const matchItem of match) {
      if (typeof matchItem === 'number') {
        idList.push(matchItem);
      } else if(typeof matchItem === 'string') {
        nameList.push(matchItem);
      }
    }
    let condition = [
      idList.length ? `id in (${idList.join()})`: '',
      ...nameList.map((name: string) => {
        const { matchStart, matchEnd, text } = formatMatchLike(name);
        if (matchStart && matchEnd) {
          placeholder.push(text);
          return `\`name\` = ?`
        }
        placeholder.push(name);
        return `\`name\` like ?`;
      }),
    ].filter(v => !!v).join(' or ');
    const selectSql = `select * from ${this.buildTableName(TableName.Tag)} ${condition ? ` where ${condition}` : ''} limit ${limit},${offset}`;
    let queryPromise = [this.query(selectSql, placeholder)]
    if (count) {
      const countSql = `select count(id) as total from ${this.buildTableName(TableName.Tag)} ${condition ? ` where ${condition}` : ''}`;
      queryPromise.push(this.query(countSql, placeholder));
    }
    const [selectRes, countRes] = await Promise.all(queryPromise).then(resultList => {
      return resultList.map(([raws]) => {
        return raws;
      });
    });
    const returnResult: ITagListResult<ITagItem> = {
      list: selectRes.map(item => {
        item.desc = item.descri;
        delete item.descri;
        return item;
      }),
    }
    if (count) {
      returnResult.total = countRes[0].total
    }
    return returnResult;
  }

  async bind(bindOptions?: ITagBindOptions): Promise<ITagOperResult> {
    return success();
  }


  async unbind(unbindOptions: ITagBindOptions): Promise<ITagOperResult> {
    return success();
  }

  async listInstance(listOptions?: ITagListInstanceOptions): Promise<ITagListResult<number>> {
    return {
      list: []
    }
  }

  async listInstanceTags(listOptions?: ITagListInstanceTagsOptions): Promise<ITagListResult<ITagItem>> {
    return {
      list: []
    }
  }

  private buildTableName(tableName) {
    const tableNameList = this.dialectOptions.tablePrefix ? [this.dialectOptions.tablePrefix, this.options.type] : [this.options.type];
    return tableNameList.concat(tableName).join(this.dialectOptions.tableSeparator || '_');
  }

  private async getTag(tagIdOrName: string | number): Promise<number> {
    const type = typeof tagIdOrName;
    let sql;
    let placeholder: any[] = [tagIdOrName];
    switch(type) {
      case 'string':
        sql = `select id from ${this.buildTableName(TableName.Tag)} where name = ?`;
        break;
      case 'number':
        sql = `select id from ${this.buildTableName(TableName.Tag)} where id = ?`;
        break;
      default:
        return;
    }
    const [raws] = await this.query(sql, placeholder);
    if (!raws?.length) {
      return;
    }
    return raws[0].id;
  }


  private async syncTable() {
    // tag table
    await this.checkOrCreateTable(this.buildTableName(TableName.Tag), [
      `\`name\` varchar(32) NULL,`,
      `\`descri\` varchar(128) NULL,`,
    ]);
    // relationship table
    await this.checkOrCreateTable(this.buildTableName(TableName.Relationship), [
      `\`tid\` BIGINT unsigned NOT NULL,`,
      `\`inid\` BIGINT unsigned NOT NULL,`,
    ]);
  }

  

  private async checkOrCreateTable(tableName: string, tableColumn: string[]) {
    const [raws] = await this.query(`SHOW TABLES LIKE '${tableName}'`);
    if (raws.length) {
      return;
    }
    const createSql = `CREATE TABLE \`${tableName}\` (
      \`id\` BIGINT unsigned NOT NULL AUTO_INCREMENT,
      ${tableColumn.join('\n')}
      \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
      \`update_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP  ON UPDATE CURRENT_TIMESTAMP NOT NULL,
      PRIMARY KEY (id)
    );`;
    await this.query(createSql);
  }
}
