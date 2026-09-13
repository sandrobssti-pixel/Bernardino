import AppError from "../../errors/AppError";
import ContactList from "../../models/ContactList";

interface Data {
  id: number | string;
  name: string;
}

const UpdateService = async (data: Data): Promise<ContactList> => {
  const { id, name } = data;
  const normalizedName = String(name || "").trim();

  const record = await ContactList.findByPk(id);

  if (!record) {
    throw new AppError("ERR_NO_CONTACTLIST_FOUND", 404);
  }

  await record.update({
    name: normalizedName
  });

  return record;
};

export default UpdateService;
