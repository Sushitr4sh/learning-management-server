import { Request, Response } from "express";
import Course from "../models/courseModel";
import { v4 as uuidv4 } from "uuid";
import { title } from "process";
import { getAuth } from "@clerk/express";

export const listCourses = async (
  req: Request,
  res: Response
): Promise<void> => {
  const { category } = req.query;
  try {
    const courses =
      category && category !== "all"
        ? await Course.scan("category").eq(category).exec()
        : await Course.scan().exec();
    /* When we set this response, we have the message and data key. But when we fetch it on RTK query,this object is being stored inside anoter variable. If you just want to access the course, you can see the custom query setup on api.ts */
    res.json({ message: "Courses retrieved successfully", data: courses });
  } catch (error) {
    res.status(500).json({ message: "Error retrieving courses", error });
  }
};

export const getCourse = async (req: Request, res: Response): Promise<void> => {
  const { courseId } = req.params;
  try {
    const course = await Course.get(courseId);
    if (!course) {
      res.status(404).json({ message: "Course not found" });
      return;
    }
    res.json({ message: "Course retrieved successfully", data: course });
  } catch (error) {
    res.status(500).json({ message: "Error retrieving course", error });
  }
};

export const createCourse = async (
  req: Request,
  res: Response
): Promise<void> => {
  const { teacherId, teacherName } = req.body;
  try {
    if (!teacherId || !teacherName) {
      res.status(400).json({ message: "Teacher Id and name are required" });
      return;
    }

    const newCourse = new Course({
      courseId: uuidv4(),
      teacherId,
      teacherName,
      title: "Untitled Course",
      description: "",
      category: "Uncategorized",
      image: "",
      price: 0,
      level: "Beginner",
      status: "Draft",
      sections: [],
      enrollments: [],
    });

    await newCourse.save();

    res.json({ message: "Course created successfully", data: newCourse });
  } catch (error) {
    res.status(500).json({ message: "Error creating course", error });
  }
};

export const updateCourse = async (
  req: Request,
  res: Response
): Promise<void> => {
  const { courseId } = req.params;
  const updateData = { ...req.body };
  const { userId } = getAuth(req);
  try {
    // Get the recently created draft course
    const course = await Course.get(courseId);
    if (!course) {
      res.status(404).json({ message: "Course not found" });
      return;
    }

    // Make sure the currently logged in user is the teacher of the course
    if (course.teacherId !== userId) {
      res.status(403).json({ message: "Not authorized to update this course" });
      return;
    }

    // $15.00 -> 1500
    if (updateData.price) {
      const price = parseInt(updateData.price);
      if (isNaN(price)) {
        res.status(400).json({
          message: "Invalid price format",
          error: "Price must be a valid number",
        });
        return;
      }
      updateData.price = price * 100;
    }

    // It's possible that our sections is a parsed version of the sections which is a bunch of array
    if (updateData.sections) {
      const sectionsData =
        typeof updateData.sections === "string"
          ? JSON.parse(updateData.sections)
          : updateData.sections;

      // Remove the id in case we want to replace it
      // We cycle through every section, make sure we update the data, then we can replace with whatever information we need
      // Because it is very nested, and in case we want to update sections/chapters we need to do this
      updateData.sections = sectionsData.map((section: any) => ({
        ...section,
        sectionId: section.sectionId || uuidv4(),
        chapters: section.chapters.map((chapter: any) => ({
          ...chapter,
          chapterId: chapter.chapterId || uuidv4(),
        })),
      }));
    }

    // We're also going to replicate the object and update it with our updateData. Basically replacing it with a  new object
    Object.assign(course, updateData);

    await course.save();

    res.json({ message: "Course updated successfully", data: course });
  } catch (error) {
    res.status(500).json({ message: "Error updating course", error });
  }
};

export const deleteCourse = async (
  req: Request,
  res: Response
): Promise<void> => {
  const { courseId } = req.params;
  const { userId } = getAuth(req);

  try {
    const course = await Course.get(courseId);

    if (!course) {
      res.status(404).json({ message: "Course not found" });
      return;
    }

    if (course.teacherId !== userId) {
      res.status(403).json({ message: "Not authorized to delete this course" });
      return;
    }

    await Course.delete(courseId);

    res.json({
      message: "Course deleted successfully",
      data: course,
    });
  } catch (error) {
    res.status(500).json({ message: "Error deleting course", error });
  }
};
