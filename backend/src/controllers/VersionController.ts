import { Request, Response } from "express";
import { version } from "../utils/version";

export const index = async (req: Request, res: Response): Promise<Response> => {
    return res.status(200).json({
        version
    });
};

export const store = async (_req: Request, res: Response): Promise<Response> => {
    return res.status(200).json({
        version
    });
};
