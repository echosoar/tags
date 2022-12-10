export interface ITagInitOptions {
  type: string;
  dialect?: ITagDialect;
}

export interface ITagDefine {
  name: string;
  desc?: string;
}

export interface ITagItem extends ITagDefine {
  id: number;
  createAt: number;
  updateAt: number;
}

export abstract class ITagDialect {
  // 新增标签
  abstract new(tagDefine: ITagDefine): Promise<ITagOperResult>;
  // 删除标签
  abstract remove(tagIdOrName: number | string): Promise<ITagOperResult>;
  // 更新标签
  abstract update(tagIdOrName: number | string, params: Partial<ITagDefine>): Promise<ITagOperResult>;
  // 列举标签
  abstract list(listOptions?: ITagSearchOptions): Promise<ITagListResult<ITagItem>>;
  // 绑定实体
  abstract bind(bindOptions: ITagBindOptions): Promise<ITagOperResult>
  // 解绑实体
  abstract unbind(unbindOptions: ITagBindOptions): Promise<ITagOperResult>
  // 根据标签列举实体
  abstract listInstance(listOptions?: ITagListInstanceOptions): Promise<ITagListResult<number>>;
  // 根据实体获取标签
  abstract listInstanceTags(listOptions?: ITagListInstanceTagsOptions): Promise<ITagListResult<ITagItem>>;
}

export interface ITagOperResult {
  success: boolean;
  message: string;
  id?: number;
}

export interface ITagListResult<ListType> {
  list: ListType[];
  total?: number;
}


export interface ITagSearchOptions extends ITagPages {
  match?: Array<number | string>;
}

export interface ITagPages {
  count?: boolean;
  pageSize?: number;
  page?: number;
}

export interface ITagBindOptions extends ITagInstance {
  // 标签列表
  tags: Array<number | string>,
  // 不存在标签的话自动创建标签，并绑定，默认为false
  autoCreateTag?: boolean;
}

export interface ITagUnBindOptions extends ITagInstance {
  // 解绑的多个标签
  tags: Array<number | string>
}

export interface ITagListInstanceTagsOptions extends ITagInstance, ITagPages{}

export interface ITagInstance {
  // 实体id
  instanceId: number,
}

export interface ITagListInstanceOptions extends ITagPages {
  tags?: Array<string|number>;
  count?: boolean;
}