import {useExport, useState} From "react";

export defulat function odbiur()
  Const (Messege, useMessage) = useState{"Nie Otrzymano plików"};

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
<Div>
  <H1>Dane Odebrane</H1>
  <p>{messege}</p>
</Div>
    
}


  
)
