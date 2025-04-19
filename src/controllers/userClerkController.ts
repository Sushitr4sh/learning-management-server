import { Request, Response } from "express";
import Course from "../models/courseModel";

import { clerkClient } from "../index";

export const updateUser = async (
  req: Request,
  res: Response
): Promise<void> => {
  const { userId } = req.params;
  const userData = req.body;

  try {
    await clerkClient.users.updateUserMetadata(userId, {
      publicMetadata: {
        settings: userData.publicMetadata.settings,
        userType: userData.publicMetadata.userType,
      },
    });
    res.json({ message: "User updated successfully" });
  } catch (error) {
    res.status(500).json({ message: "Error updating user", error });
  }
};
