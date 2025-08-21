import {useeffect, useState} from "react";

export default function odbiur()
  const (message, useMessage) = useState{"Nie Otrzymano plików"};

useEffect(( => {

  fetch("api/PAY/creat-order")
  .then((res) => res.Json())
  .then(data) =>
  If(data.string) {
    SetMessage(data.String);
  }
       ))
          .catch(() => {
            setMessage("Nie Otrzymano Danych");
          });
  },[]);

returne{
<div>
  <h1>Dane Odebrane</h1>
  <p>{message}</p>
</div>
    
};
)
