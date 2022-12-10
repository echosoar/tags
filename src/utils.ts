export const success = (data: any = {}, message = 'success') => {
  return {
    success: true,
    message,
    ...data,
  }
}

export const error = (message: string, data?: any) => {
  return {
    success: false,
    message,
    ...data,
  }
}

export const getPageOpions = (page = 1, pageSize = 20) => {
  if (page === 1 && pageSize === Infinity) {
    return {
      limit: 0,
      offset: Infinity,
      end: Infinity,
    };
  }
  const pageSizeNumber = +pageSize;
  const start = (+page - 1) * pageSizeNumber;
  const end = start + pageSizeNumber;
  return {
    limit: start,
    offset: pageSizeNumber,
    end,
  }
}