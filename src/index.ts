import { MemoryDialect, MysqlDialect } from "./dialect";
import { TAG_ERROR } from "./error";
import { ITagBindOptions, ITagDefine, ITagDialect, ITagDialectInstance, ITagInitOptions, ITagItem, ITagListInstanceOptions, ITagListInstanceTagsOptions, ITagListResult, ITagOperResult, ITagSearchOptions, ITagServiceInitOptions, ITagUnBindOptions } from "./interface";
import { error } from "./utils";
export * from './interface';
export * from './error';
class TagService {
  private dialect: ITagDialectInstance;
  constructor(initOptions: ITagServiceInitOptions) {
    this.dialect = initOptions.dialect.getInstance(initOptions.group);
  }

  async new(tagDefine: ITagDefine) {
    return this.dialect.new(tagDefine);
  }

  async remove(tagIdOrName: number | string): Promise<ITagOperResult> {
    return this.dialect.remove(tagIdOrName);
  }

  async update(tagIdOrName: number | string, params: Partial<ITagDefine>): Promise<ITagOperResult> {
    return this.dialect.update(tagIdOrName, params);
  }
  async list(listOptions?: ITagSearchOptions): Promise<ITagListResult<ITagItem>> {
    return this.dialect.list({
      page: 1,
      pageSize: 20,
      ...listOptions
    });
  }

  async bind(bindOptions: ITagBindOptions): Promise<ITagOperResult> {
    if (!bindOptions.tags?.length) {
      return error(TAG_ERROR.MISSING_PARAMETERS, { need: 'tags' });
    }
    return this.dialect.bind(bindOptions);
  }

  async unbind(unbindOptions: ITagUnBindOptions): Promise<ITagOperResult> {
    return this.dialect.unbind(unbindOptions);
}

  async listObjects(listOptions?: ITagListInstanceOptions): Promise<ITagListResult<number>> {
    return this.dialect.listObjects({
      page: 1,
      pageSize: 20,
      tags: [],
      ...listOptions
    });
  }

  async listObjectTags(listOptions?: ITagListInstanceTagsOptions): Promise<ITagListResult<ITagItem>> {
    return this.dialect.listObjectTags({
      page: 1,
      pageSize: 20,
      ...listOptions
    });
  }
}

export class TagManager {
  private initOptions: ITagInitOptions;
  private dialect: ITagDialect;
  constructor(initOptions: ITagInitOptions = {}) {
    this.initOptions = initOptions;
    switch(this.initOptions.dialect?.dialectType) {
      case 'mysql':
        this.dialect = new MysqlDialect(this.initOptions);
        break;
      default:
        this.dialect = new MemoryDialect();
        break;
    }
  }

  async ready() {
    await this.dialect.ready();
  }

  getService(group = 'default'): TagService {
    return new TagService({
      group,
      dialect: this.dialect,
    })
  }
}