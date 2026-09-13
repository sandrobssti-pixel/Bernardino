import React, { useContext, useEffect, useState } from "react";
import { Grid } from "@material-ui/core";
import { InputField } from "../../FormFields";
import { AuthContext } from "../../../context/Auth/AuthContext";

export default function AddressForm(props) {

  const { user } = useContext(AuthContext);
  const companyName = user?.company?.name || user?.name || "";
  const companyDocument = user?.company?.document || "";

  const [billingName, setBillingName] = useState(companyName);
  const [addressZipCode, setAddressZipCode] = useState(companyDocument);

  const {
    formField: {
      firstName,
      zipcode,
    },
    setFieldValue
  } = props;
  useEffect(() => {
    setFieldValue("firstName", billingName)
    setFieldValue("zipcode", addressZipCode)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <React.Fragment>
  
      <Grid container spacing={3}>

        <Grid item xs={6} sm={6}>
          <InputField name={firstName.name} label={firstName.label} fullWidth
            value={billingName}
            onChange={(e) => {
              setBillingName(e.target.value)
              setFieldValue("firstName", e.target.value)
            }}
          />
        </Grid>

        <Grid item xs={6} sm={6}>
          <InputField
            name={zipcode.name}
            label={zipcode.label}
            fullWidth
            value={addressZipCode}
            onChange={(e) => {
              setAddressZipCode(e.target.value)
              setFieldValue("zipcode", e.target.value)
            }}
          />
        </Grid>
        

      </Grid>
    </React.Fragment>
  );
}
