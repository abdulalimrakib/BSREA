import { Request } from "express";

/*--Helpers shared by the staff (admin) controllers--*/

/*--The numeric :id from the URL, or null when it isn't a positive whole number--*/
export const idParam = (req: Request) => {
  const id = Number(req.params.id);
  return Number.isInteger(id) && id > 0 ? id : null;
};

export type Row = Record<string, unknown>;
