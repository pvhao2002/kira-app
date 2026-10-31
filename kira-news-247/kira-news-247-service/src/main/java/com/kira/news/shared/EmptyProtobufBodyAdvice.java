package com.kira.news.shared;

import com.google.protobuf.Message;
import org.springframework.core.MethodParameter;
import org.springframework.http.HttpInputMessage;
import org.springframework.http.converter.HttpMessageConverter;
import org.springframework.web.bind.annotation.ControllerAdvice;
import org.springframework.web.servlet.mvc.method.annotation.RequestBodyAdviceAdapter;

import java.lang.reflect.Type;

/**
 * A protobuf message whose fields are all defaults (e.g. a resolve request with no note) encodes to zero bytes.
 * Spring treats an empty body as missing, so hand the controller the message's default instance instead.
 */
@ControllerAdvice
public class EmptyProtobufBodyAdvice extends RequestBodyAdviceAdapter {
    @Override
    public boolean supports(MethodParameter parameter, Type targetType, Class<? extends HttpMessageConverter<?>> converterType) {
        return Message.class.isAssignableFrom(parameter.getParameterType());
    }

    @Override
    public Object handleEmptyBody(Object body, HttpInputMessage inputMessage, MethodParameter parameter, Type targetType,
                                  Class<? extends HttpMessageConverter<?>> converterType) {
        if (body != null) {
            return body;
        }
        try {
            return parameter.getParameterType().getMethod("getDefaultInstance").invoke(null);
        } catch (ReflectiveOperationException e) {
            throw new IllegalStateException("Not a generated protobuf message: " + parameter.getParameterType(), e);
        }
    }
}
