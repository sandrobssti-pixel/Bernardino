import { listOrphanCompanyFolders, PublicCompanyFolderAudit } from "./publicFolderAudit";

const ListOrphanCompanyFoldersService = async (): Promise<PublicCompanyFolderAudit[]> => {
  return listOrphanCompanyFolders();
};

export default ListOrphanCompanyFoldersService;
